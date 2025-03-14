import { UserActivityService } from './userActivityService';
import type { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import type { googletag } from '@highfivve/ad-tag/source/ts/types/googletag';
import { RefreshIntervalOverrides, ViewabilityOverrides } from './index';
import type { IntersectionObserverWindow } from '@highfivve/ad-tag/source/ts/types/dom';

/**
 * Tracks the visibility of ad slots.
 *
 * Ad slots featuring the "refreshing" behavior may be refreshed after a certain period of visibility. The visibility
 * is calculated in this service using the events of an Intersection Observer.
 *
 * We don't track visibility of browsers not supporting Intersection Observer since that would require more expensive
 * scroll listener and bounding box calculations. All common browsers except Internet Explorer do support Intersection
 * Observers.
 */

export class AdVisibilityService {
  /**
   * Visibility durations are updated in this interval. Whether a slot is visible is decided outside this interval
   * by Intersection Observer callbacks.
   */
  static readonly updateVisibilityInterval = 1000;

  /**
   * Added delay for consecutive ad refreshes
   */
  static readonly consecutiveDurationToRefresh = 1500;

  /**
   * Ratio that an ad has to be in the visible viewport of the browser to be considered seen. 0.5 = 50%.
   */
  private readonly minimalAdVisibilityRatio: number;

  private visibilityRecords: Map<string, VisibilityRecord>;
  private readonly intersectionObserver?: IntersectionObserver;

  /**
   * Timer updating the ad visibility every second while users show any activity.
   */
  private visibilityUpdateTimer: number | undefined;

  constructor(
    private readonly userActivityService: UserActivityService,
    private readonly refreshInterval: number,
    private readonly refreshIntervalOverrides: RefreshIntervalOverrides,
    readonly useIntersectionObserver: boolean,
    private readonly disableAdVisibilityChecks: boolean,
    private readonly viewabilityOverrides: ViewabilityOverrides,
    private readonly window: Window & IntersectionObserverWindow & googletag.IGoogleTagWindow,
    private readonly logger?: Moli.MoliLogger
  ) {
    this.minimalAdVisibilityRatio = disableAdVisibilityChecks ? 0 : 0.5;

    this.visibilityRecords = new Map<string, VisibilityRecord>();

    // instantiate IntersectionObserver if it is enabled or if there are custom overrides that
    // require an observer to be available
    const requiredIntersectionObserver =
      (useIntersectionObserver || Object.keys(viewabilityOverrides).length > 0) &&
      'IntersectionObserver' in this.window;

    if (requiredIntersectionObserver) {
      this.intersectionObserver = new this.window.IntersectionObserver(
        entries => this.handleObservedAdVisibilityChanged(entries),
        { threshold: this.minimalAdVisibilityRatio }
      );
    }

    if (!useIntersectionObserver) {
      this.window.googletag
        .pubads()
        .addEventListener('slotVisibilityChanged', this.handleGoogletagAdVisibilityChanged);
    }

    this.userActivityService.addUserActivityChangedListener(state =>
      this.handleUserActivityChanged(state)
    );

    this.setUpdateTimer(true);

    this.logger?.debug('AdVisibilityService', 'initialized');
  }

  /**
   * Determine if the adVisibilityService tracks a slot with the given dom id.
   */
  isSlotTracked = (domId: string): boolean => this.visibilityRecords.has(domId);

  /**
   * Add a refreshable ad slot to this service.
   *
   * @param slot              a refreshable ad slot with "visibility" trigger
   * @param refreshCallback   callback fired when the configured duration is up
   */
  trackSlot(slot: googletag.IAdSlot, refreshCallback: (slot: googletag.IAdSlot) => void): void {
    const slotDomId = slot.getSlotElementId();
    const domElement = this.observedDomElementForSlot(slot);

    if (domElement) {
      this.logger?.debug('AdVisibilityService', `tracking slot ${slot.getSlotElementId()}`, slot);

      if (this.isSlotTracked(slotDomId)) {
        this.removeSlotTracking(slot);
      }

      this.visibilityRecords.set(slot.getSlotElementId(), {
        slot: slot,
        latestStartVisible: this.disableAdVisibilityChecks
          ? this.window.performance.now()
          : undefined,
        durationVisibleSum: 0,
        refreshCallback: refreshCallback
      });

      // use intersection observer if required due to viewability overrides or because it is globally
      // enabled ( usually for none gpt.js environments like test or prebid-only setups )
      if (
        this.intersectionObserver &&
        (domElement.targetOverride || this.useIntersectionObserver)
      ) {
        this.intersectionObserver.observe(domElement.target);
      }
    }
  }

  removeSlotTracking = (slot: googletag.IAdSlot) => {
    this.logger?.debug(
      'AdVisibilityService',
      `removing slot visibility tracking for ${slot.getSlotElementId()}`,
      slot
    );

    this.visibilityRecords.delete(slot.getSlotElementId());

    const observedSlot = this.observedDomElementForSlot(slot);
    if (this.intersectionObserver && observedSlot) {
      this.intersectionObserver.unobserve(observedSlot.target);
    }
  };

  private setUpdateTimer(state: boolean): void {
    if (state) {
      this.visibilityUpdateTimer = this.window.setInterval(
        () => this.updateAdVisibilityDuration(),
        AdVisibilityService.updateVisibilityInterval
      );
    } else {
      this.window.clearInterval(this.visibilityUpdateTimer);
      this.visibilityUpdateTimer = undefined;
    }
  }

  /**
   * Returns all observed slots that should be reloaded.
   */
  private updateAdVisibilityDuration(): void {
    // flush current visible time
    this.visibilityRecords.forEach(record => {
      if (record.latestStartVisible) {
        const now = this.window.performance.now();
        const addedDuration = Math.round(now - record.latestStartVisible);

        record.durationVisibleSum += addedDuration;
        record.latestStartVisible = now;

        this.logger?.debug(
          'AdVisibilityService',
          `added ${addedDuration}ms visibility to ${record.slot.getSlotElementId()}, now totalling at ${
            record.durationVisibleSum
          }ms`
        );
      }
    });

    Array.from(this.visibilityRecords.values())
      .filter(record => {
        const interval: number =
          this.refreshIntervalOverrides[record.slot.getSlotElementId()] || this.refreshInterval;
        return record.durationVisibleSum > interval;
      })
      .forEach(record => {
        this.logger?.debug(
          'AdVisibilityService',
          `refreshing ad ${record.slot.getSlotElementId()} after ${
            record.durationVisibleSum
          }ms visibility`
        );

        record.latestStartVisible = this.window.performance.now();
        // consecutive ad refreshes are delayed by a few seconds to factor in loading times
        record.durationVisibleSum = -AdVisibilityService.consecutiveDurationToRefresh;
        record.refreshCallback(record.slot);
      });
  }

  private handleGoogletagAdVisibilityChanged = (
    event: googletag.events.ISlotVisibilityChangedEvent
  ): void => {
    const slot = event.slot;
    const visibilityRecord = this.visibilityRecordForGoogletagEvent(event);

    if (visibilityRecord) {
      this.logger?.debug(
        'AdVisibilityService',
        `Visibility of slot ${slot.getSlotElementId()} changed. Visible area: ${
          event.inViewPercentage
        }%`
      );

      this.updateVisibilityRecord(visibilityRecord, event.inViewPercentage / 100);
    }
  };

  private handleObservedAdVisibilityChanged(entries: IntersectionObserverEntry[]): void {
    entries.forEach(entry => {
      const visibilityRecord = this.visibilityRecordForEntry(entry);

      if (visibilityRecord) {
        this.logger?.debug(
          'AdVisibilityService',
          `Visibility of slot ${visibilityRecord.slot.getSlotElementId()} changed. Visible area: ${
            entry.intersectionRatio * 100
          }%`
        );

        this.updateVisibilityRecord(visibilityRecord, entry.intersectionRatio);
      }
    });
  }

  private updateVisibilityRecord = (
    visibilityRecord: VisibilityRecord,
    adVisibilityRatio: number
  ) => {
    if (visibilityRecord.latestStartVisible) {
      const addedDuration = this.window.performance.now() - visibilityRecord.latestStartVisible;
      this.logger?.debug(
        'AdVisibilityService',
        `added ${Math.round(
          addedDuration
        )}ms visibility to ${visibilityRecord.slot.getSlotElementId()}`
      );
      visibilityRecord.durationVisibleSum += addedDuration;
    }

    if (adVisibilityRatio >= this.minimalAdVisibilityRatio) {
      visibilityRecord.latestStartVisible = this.window.performance.now();
      this.logger?.debug(
        'AdVisibilityService',
        `ad ${visibilityRecord.slot.getSlotElementId()} visible`
      );
    } else {
      visibilityRecord.latestStartVisible = undefined;
      this.logger?.debug(
        'AdVisibilityService',
        `ad ${visibilityRecord.slot.getSlotElementId()} not visible`
      );
    }
  };

  private handleUserActivityChanged(userActivityState: boolean): void {
    // bump the start visible timer when the user is active again
    this.visibilityRecords.forEach(record => {
      // if record.latestStartVisible is undefined, the slot is not visible.
      if (record.latestStartVisible) {
        record.latestStartVisible = this.window.performance.now();
      }
    });

    this.setUpdateTimer(userActivityState);
  }

  private visibilityRecordForEntry(entry: IntersectionObserverEntry): VisibilityRecord | undefined {
    return this.visibilityRecords.get(entry.target.id);
  }

  private visibilityRecordForGoogletagEvent = (
    event: googletag.events.ISlotVisibilityChangedEvent
  ): VisibilityRecord | undefined => this.visibilityRecords.get(event.slot.getSlotElementId());

  /**
   * use the override element if it exists, otherwise use the ad slot element
   * this is necessary for ad formats that do not exist inside the regular ad slot element
   * @param slot
   */
  private observedDomElementForSlot(
    slot: googletag.IAdSlot
  ): { target: HTMLElement; targetOverride: boolean } | null {
    const slotDomId = slot.getSlotElementId();
    const viewabilityOverride = this.viewabilityOverrides[slotDomId];
    const adSlotElement = this.window.document.getElementById(slotDomId);
    const overrideElement = viewabilityOverride
      ? this.window.document.querySelector<HTMLElement>(viewabilityOverride.cssSelector)
      : null;
    return overrideElement
      ? { target: overrideElement, targetOverride: true }
      : adSlotElement
      ? { target: adSlotElement, targetOverride: false }
      : null;
  }
}

/**
 * Stores an ad slot and relevant visibility data.
 */
type VisibilityRecord = {
  /**
   * The refreshable ad slot.
   */
  slot: googletag.IAdSlot;
  /**
   * Point in time when this ad became visible to the user. Undefined when this slot is currently not seen.
   */
  latestStartVisible: number | undefined;
  /**
   * Total visibility duration (in ms).
   */
  durationVisibleSum: number;
  /**
   * Callback called when durationVisibleSum reaches durationToRefresh.
   */
  refreshCallback: (slot: googletag.IAdSlot) => void;
};
