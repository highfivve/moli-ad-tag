import { Moli } from '../../../source/ts/types/moli';
import { googletag } from '../../../source/ts/types/googletag';
import { IPerformanceMeasurementService } from './../util/performanceService';
import { SlotEventService } from './slotEventService';
import {
  HIGH_PRIORITY,
  mkPrepareRequestAdsStep,
  PrepareRequestAdsStep
} from './adPipeline';

/**
 * Add event listeners on the slots that should be monitored.
 * The reporting is only active for the first request.
 *
 * @param reportingService
 */
export const reportingPrepareRequestAds = (reportingService: IReportingService): PrepareRequestAdsStep => mkPrepareRequestAdsStep('reporting-enabled', HIGH_PRIORITY, (ctx, slots) => {
  if (ctx.requestId === 1) {
    ctx.logger.debug('Reporting', 'initialize reporting', slots);
    reportingService.initialize(slots.map(slot => slot.moliSlot));
  }
  return Promise.resolve();
});

export interface IReportingService {

  /**
   * Adds all required listeners and starts gathering performance metrics.
   *
   * @param adSlots all available ad slots that will be requested.
   *        Should not contain lazy loading slots as these skew the results
   */
  initialize(adSlots: Moli.AdSlot[]): void;

  /**
   * Set a marker when the given adSlot is being refreshed.
   * @param adSlot
   */
  markRefreshed(adSlot: Moli.AdSlot): void;

  /**
   * @param callIndex describes which call should be marked. Prebid slots can be requested
   *        multiple times, which is why we need to add this information to the mark name.
   */
  markPrebidSlotsRequested(callIndex: number): void;

  /**
   * @param callIndex describes which call should be marked. Prebid slots can be requested
   *        multiple times, which is why we need to add this information to the mark name.
   */
  measureAndReportPrebidBidsBack(callIndex: number): void;

  /**
   * @param callIndex describes which call should be marked. Prebid slots can be requested
   *        multiple times, which is why we need to add this information to the mark name.
   */
  markA9fetchBids(callIndex: number): void;

  /**
   * @param callIndex describes which call should be marked. Prebid slots can be requested
   *        multiple times, which is why we need to add this information to the mark name.
   */
  measureAndReportA9BidsBack(callIndex: number): void;

  /**
   * Set a marker when the cmp started loading
   */
  markCmpInitialization(): void;

  /**
   * Creates a performance measure for `cmp_load_time` metric and reports it
   */
  measureCmpLoadTime(): void;
}

/**
 * ## Reporting Service
 *
 * Provides an API for reporting and exports Web Performance API marks and measures.
 *
 */
export class ReportingService implements IReportingService {

  private readonly adUnitRegex: string | RegExp;

  /**
   * unique identifier to associate requests made from a single page view in our tracking data.
   */
  private readonly pageRequestId: string;

  /**
   * True if the page requests should be used as a performance measurement sample.
   *
   * WARNING: the `performanceService` has it's own sample rate, when using `measureAndSend`!
   */
  private readonly isSample: boolean;

  private readonly slotRenderEndedEvent: { [domId: string]: googletag.events.ISlotRenderEndedEvent | undefined } = {};

  /**
   * get the performance measure name for
   * @param type
   */
  public static getSingleMeasurementMetricMeasureName(type: 'cmpLoad' | 'dfpLoad' | 'prebidLoad' | 'a9Load' | 'ttfa' | 'ttfr'): string {
    switch (type) {
      case 'cmpLoad':
        return 'cmp_load_time';
      case 'dfpLoad':
        return 'dfp_load_time';
      case 'prebidLoad':
        return 'prebid_load_time';
      case 'a9Load':
        return 'a9_load_time';
      case 'ttfa':
        return 'dfp_time_to_first_ad';
      case 'ttfr':
        return 'dfp_time_to_first_render';
    }
  }

  constructor(
    private readonly performanceService: IPerformanceMeasurementService,
    private readonly slotEventService: SlotEventService,
    private readonly config: Moli.reporting.ReportingConfig,
    private readonly logger: Moli.MoliLogger,
    private readonly env: Moli.Environment,
    private readonly window: Window
  ) {
    // the default regex only removes the publisher id
    this.adUnitRegex = config.adUnitRegex || /\/\d*\//i;

    try {
      this.pageRequestId = this.uuidv4();
      this.isSample = Math.random() <= config.sampleRate;
      logger.debug(`AdPerformanceService`, `isSample ${this.isSample} (${config.sampleRate}) | pageRequestId ${this.pageRequestId}`);
    } catch (e) {
      // fallback if anything goes wrong
      this.pageRequestId = '00000000-0000-0000-0000-000000000000';
      this.isSample = false;
      logger.error('[ReportingService] Initializing failed', e);
    }
  }


  public initialize(adSlots: Moli.AdSlot[]): void {
    this.performanceService.mark('dfp_load_start');
    this.measureAndReportFirstAdRenderTime();
    this.measureAndReportFirstAdLoadTime();
    this.initAdSlotMetrics();

    this.slotEventService.awaitAllAdSlotsRendered(adSlots)
      .then(renderedEvents => this.reportAdSlotsMetric(renderedEvents))
      .then(() => this.measureAndReportDfpLoadTime());
  }


  public markRefreshed(adSlot: Moli.AdSlot): void {
    this.performanceService.mark(`${this.minimalAdUnitName(adSlot.adUnitPath)}_refreshed`);
  }


  public markPrebidSlotsRequested(callIndex: number): void {
    this.performanceService.mark(`prebid_requested_${callIndex}`);
  }

  public measureAndReportPrebidBidsBack(callIndex: number): void {
    const measure = ReportingService.getSingleMeasurementMetricMeasureName('prebidLoad');
    this.performanceService.measure(
      `${measure}_${callIndex}`,
      `prebid_requested_${callIndex}`,
      `prebid_bids_back_${callIndex}`
    );

    // For the first request also store it in a better accessible field
    if (callIndex === 1) {
      this.performanceService.measure(
        measure,
        `prebid_requested_${callIndex}`,
        `prebid_bids_back_${callIndex}`
      );
    }

    const prebid = this.performanceService.getMeasure(`${measure}_${callIndex}`);

    if (prebid) {
      this.report({
        type: 'prebidLoad',
        pageRequestId: this.pageRequestId,
        measurement: prebid
      });
    }
  }

  public markA9fetchBids(callIndex: number): void {
    this.performanceService.mark(`a9_requested_${callIndex}`);
  }

  public measureAndReportA9BidsBack(callIndex: number): void {
    const measure = ReportingService.getSingleMeasurementMetricMeasureName('a9Load');
    this.performanceService.measure(`${measure}_${callIndex}`, `a9_requested_${callIndex}`, `a9_bids_back_${callIndex}`);

    const a9 = this.performanceService.getMeasure(`${measure}_${callIndex}`);

    // For the first request also store it in a better accessible field
    if (callIndex === 1) {
      this.performanceService.measure(measure, `a9_requested_${callIndex}`, `a9_bids_back_${callIndex}`);
    }

    if (a9) {
      this.report({
        type: 'a9Load',
        pageRequestId: this.pageRequestId,
        measurement: a9
      });
    }
  }

  public markCmpInitialization(): void {
    this.performanceService.mark('cmp_load_start');
  }

  public measureCmpLoadTime(): void {
    const measure = ReportingService.getSingleMeasurementMetricMeasureName('cmpLoad');
    this.performanceService.mark('cmp_load_end');
    this.performanceService.measure(measure, 'cmp_load_start', 'cmp_load_end');

    const cmpLoad = this.performanceService.getMeasure(measure);
    if (cmpLoad) {
      this.report({
        type: 'cmpLoad',
        pageRequestId: this.pageRequestId,
        measurement: cmpLoad
      });
    }
  }

  /**
   * If this page request should be measured and tracked
   */
  private shouldTrack(): boolean {
    return this.isSample;
  }

  private report(metric: Moli.reporting.Metric): void {
    if (this.shouldTrack()) {
      this.config.reporters.forEach(reporter => reporter(metric));
    }
  }

  /**
   * Creates a performance measure for the `ttfr` (time to first render) metric and reports it.
   */
  private measureAndReportFirstAdRenderTime(): void {
    switch (this.env) {
      case 'production':
        new Promise<void>(resolve => {
          let isResolved = false;
          this.window.googletag.pubads().addEventListener('slotRenderEnded', () => {
            if (!isResolved) {
              resolve();
              isResolved = true;
            }
          });
        }).then(() => {
          const measure = ReportingService.getSingleMeasurementMetricMeasureName('ttfr');
          this.performanceService.measure(measure, 'dfp_load_start', 'dfp_time_to_first_render_end');


          const timeToFirstAd = this.performanceService.getMeasure(measure);
          if (timeToFirstAd) {
            this.report({
              type: 'ttfr',
              pageRequestId: this.pageRequestId,
              measurement: timeToFirstAd
            });
          }
        });
        break;
      case 'test':
        this.logger.warn('ReportingService', 'In test environment no time-to-first-render will be reported');
        break;
    }

  }

  /**
   * Creates a performance measure for the `ttfa` (time to first ad) metric and reports it.
   */
  private measureAndReportFirstAdLoadTime(): void {
    switch (this.env) {
      case 'production':
        new Promise<void>(resolve => {
          let isResolved = false;
          this.window.googletag.pubads().addEventListener('slotOnload', () => {
            if (!isResolved) {
              resolve();
              isResolved = true;
            }
          });
        }).then(() => {
          const measure = ReportingService.getSingleMeasurementMetricMeasureName('ttfa');
          this.performanceService.measure(measure, 'dfp_load_start', 'dfp_time_to_first_ad_end');


          const timeToFirstAd = this.performanceService.getMeasure(measure);
          if (timeToFirstAd) {
            this.report({
              type: 'ttfa',
              pageRequestId: this.pageRequestId,
              measurement: timeToFirstAd
            });
          }
        });
        break;
      case 'test':
        this.logger.warn('In test environment no time-to-first-loads will be reported');
        break;
    }
  }

  private awaitAdSlotContentLoaded(event: googletag.events.ISlotRenderEndedEvent): Promise<googletag.events.ISlotOnloadEvent> {
    // no ad on this slot this time. sad panda.
    if (event.isEmpty || !event.slot) {
      return Promise.resolve(event);
    }

    return new Promise<googletag.events.ISlotOnloadEvent>(resolve => {
      this.window.googletag.pubads().addEventListener('slotOnload', (onLoadEvent) => {
        if (onLoadEvent.slot.getAdUnitPath() === event.slot.getAdUnitPath()) {
          resolve(onLoadEvent);
        }
      });
    });
  }

  private measureAndReportDfpLoadTime(): void {
    const measure = ReportingService.getSingleMeasurementMetricMeasureName('dfpLoad');
    this.performanceService.measure(measure, 'dfp_load_start', 'dfp_load_end');
    const dfpLoad = this.performanceService.getMeasure(measure);
    if (dfpLoad) {
      this.report({
        type: 'dfpLoad',
        pageRequestId: this.pageRequestId,
        measurement: dfpLoad
      });
    }
  }

  private initAdSlotMetrics(): void {
    this.window.googletag.pubads().addEventListener('slotRenderEnded', renderEndedEvent => {
      const adUnitName = this.minimalAdUnitName(renderEndedEvent.slot.getAdUnitPath());
      this.performanceService.measure(
        `${adUnitName}_rendered`,
        `dfp_load_start`,
        `${adUnitName}_rendered`);

      this.slotRenderEndedEvent[renderEndedEvent.slot.getSlotElementId()] = renderEndedEvent;
    });

    // slot on load
    this.window.googletag.pubads().addEventListener('slotOnload', onloadEvent => {
      const adUnitName = this.minimalAdUnitName(onloadEvent.slot.getAdUnitPath());
      this.performanceService.mark(`${adUnitName}_content_loaded`);
      // measure: rendering
      this.performanceService.measure(
        `${adUnitName}_render_content_loaded`,
        `${adUnitName}_rendered`,
        `${adUnitName}_content_loaded`);

      // measure: loaded
      this.performanceService.measure(
        `${adUnitName}_content_loaded_total`,
        `dfp_load_start`,
        `${adUnitName}_content_loaded`);

      // report metric
      const renderEndedEvent = this.slotRenderEndedEvent[onloadEvent.slot.getSlotElementId()];
      const renderedMeasure = this.performanceService.getMeasure(`${adUnitName}_rendered`);
      const renderingMeasure = this.performanceService.getMeasure(`${adUnitName}_render_content_loaded`);
      const contentMeasure = this.performanceService.getMeasure(`${adUnitName}_content_loaded_total`);
      const refreshedMark = this.performanceService.getMark(`${adUnitName}_refreshed`);

      // bail out if any of the requested values cannot be accessed
      if (!contentMeasure || !renderingMeasure || !renderedMeasure || !refreshedMark || !renderEndedEvent) {
        return;
      }

      // remove event from internal storage
      delete this.slotRenderEndedEvent[onloadEvent.slot.getSlotElementId()];

      const adSlotMetric: Moli.reporting.AdSlotMetric = {
        type: 'adSlot',
        pageRequestId: this.pageRequestId,
        adUnitName: adUnitName,
        advertiserId: renderEndedEvent.advertiserId,
        campaignId: renderEndedEvent.campaignId,
        lineItemId: renderEndedEvent.lineItemId || renderEndedEvent.sourceAgnosticLineItemId,
        refresh: refreshedMark,
        rendered: renderedMeasure,
        rendering: renderingMeasure,
        loaded: contentMeasure
      };

      this.report(adSlotMetric);
    });
  }


  /**
   * Used for performance logging to create more readable names
   * @param adUnit the full adUnit path
   * @return stripped adunit path with only the relevant stuff
   */
  private minimalAdUnitName(adUnit: string): string {
    return adUnit.replace(this.adUnitRegex, '');
  }

  private reportAdSlotsMetric(renderedEvents: googletag.events.ISlotRenderEndedEvent[]): googletag.events.ISlotRenderEndedEvent[] {
    const adSlotsMetric: Moli.reporting.AdSlotsMetric = {
      type: 'adSlots',
      numberAdSlots: renderedEvents.length,
      numberEmptyAdSlots: renderedEvents.filter(slot => slot.isEmpty).length
    };

    this.report(adSlotsMetric);

    return renderedEvents;
  }


  /**
   * minimalistic uuid generation.
   * @see https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
   */
  private uuidv4(): string {
    /* tslint:disable */
    if ('crypto' in this.window && 'getRandomValues' in this.window.crypto) {
      return (([ 1e7 ] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) =>
        (c ^ this.window.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
    } else {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    /* tslint:enabled */
  }

}

export const noopReportingService: IReportingService = {
  initialize: () => {
  },
  markRefreshed: () => {
  },
  markPrebidSlotsRequested: () => {
  },
  measureAndReportPrebidBidsBack: () => {
  },
  markA9fetchBids: () => {
  },
  measureAndReportA9BidsBack: () => {
  },
  markCmpInitialization: () => {
  },
  measureCmpLoadTime: () => {
  }
};