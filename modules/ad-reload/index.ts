/**
 * Moli's own Ad Reload solution to optimize long lived user sessions by reloading
 * specific ad slots.
 *
 * ## Integration
 *
 * In your `index.ts`, import AdReload and register the module.
 *
 * ```js
 * import { AdReload } from '@highfivve/module-moli-ad-reload';
 *
 * moli.registerModule(new AdReload({
 *    excludeAdSlotDomIds: [ ... ],
 *    optimizeClsScoreDomIds: [ ... ],
 *    includeAdvertiserIds: [ ... ],
 *    includeOrderIds: [ ... ],
 *    excludeOrderIds: [ ... ],
 *    refreshIntervalMs: 20000,
 *    userActivityLevelControl: { level: 'moderate' }
 *  })
 * );
 *  ```
 *
 * Configure the module with:
 *
 * * the DOM IDs you want to **exclude** from being reloaded
 * * the DOM IDs that have an influence on content positioning, e.g. header or content positions - the module
 *   will make sure that reloading these slots will not negatively impact CLS scores
 * * the order ids ("campaign ids" in Google's terminology) you want to **include** for reloading
 * * the advertiser ids ("company ids" in Google's terminology) you want to **include** for reloading
 * * the order ids ("campaign ids" in Google's terminology) you want to **exclude** from reloading;
 *   this option **overrides the includes**!
 * **[optional]** the refresh interval that the reload module should wait before reloading a slot. The interval
 * specifies the minimum time in which the ad has to be visible before refreshing it.
 * * **[optional]** the strictness of checking user activity. The strictness levels are defined like this:
 *   * strict:
 *     * userActivityDuration: 10 seconds
 *     * userBecomingInactiveDuration: 5 seconds
 *   * moderate:
 *     * userActivityDuration: 12 seconds
 *     * userBecomingInactiveDuration: 8 seconds
 *   * lax:
 *     * userActivityDuration: 15 seconds
 *     * userBecomingInactiveDuration: 12 seconds
 *   * custom:
 *     * userActivityDuration: configurable
 *     * userBecomingInactiveDuration: configurable
 * @module
 */
import {
  IModule,
  ModuleType,
  Moli,
  googletag,
  IAssetLoaderService,
  getLogger,
  AdPipeline,
  AdPipelineContext,
  mkConfigureStep,
  IntersectionObserverWindow
} from '@highfivve/ad-tag';

import { AdVisibilityService } from './adVisibilityService';
import { UserActivityLevelControl, UserActivityService } from './userActivityService';

export type RefreshIntervalOverrides = {
  [slotDomId: string]: number;
};

export type ViewabilityOverrideEntry =
  | {
      variant: 'css';
      /** Used to select a single element to monitor for viewability */
      cssSelector: string;
    }
  | {
      /**
       * Enable reloading ads that are not in viewport. It is not advised to use this option.
       * Impressions are usually only counted on ads that have been 50% visible, and it's generally not
       * very user-centric to load stuff that is out of viewport.
       */
      variant: 'disabled';

      /**
       * Enable reloading ads that are not in viewport without any restrictions.
       *
       * It is not advised to use this option. Impressions are usually only counted on ads that
       * have been 50% visible, and it's generally not very user-centric to load stuff that is out
       * of viewport.
       *
       * Set this to false and provide additional configuration options to restrict the unconditional
       * ad reload to certain advertisers.
       */
      disableAllAdVisibilityChecks: boolean;

      /**
       *  An optional list of advertisers that are allowed to be reloaded, but no additional ad visibility check is performed.
       *  This is necessary for special formats that may take a bit of time to render and the DOM elements are not yet ready,
       *  when the IntersectionObserver is about to be configured.
       */
      disabledAdVisibilityCheckAdvertiserIds?: number[];
    };

/**
 * Viewability is measured by gpt visibility events or a separate IntersectionObserver.
 *
 * This configuration object allows to provide a CSS selector to check for visibility.
 * If set and available in the DOM it will be used to check for visibility with an IntersectionObserver.
 * Otherwise, the configured default behavior will be used.
 *
 * A record in this overrides object is a mapping of a slot's DOM id to the override configuration.
 */
export type ViewabilityOverrides = {
  /**
   * Ad Slot DOM ID to viewability configuration
   */
  [slotDomId: string]: ViewabilityOverrideEntry | undefined;
};

export type AdReloadModuleConfig = {
  /**
   * Ad slots that should never be reloaded
   */
  excludeAdSlotDomIds: Array<string>;

  /**
   * Ad slots that have an influence on content positioning should be included here. The ad reload
   * module will make sure that reloading these slots will not negatively impact CLS scores.
   *
   * @see https://web.dev/cls/
   */
  optimizeClsScoreDomIds: Array<string>;

  /**
   * Include list for advertisers that are eligible to be reloaded.
   * The id can be obtained from your google ad manager in the admin/company section.
   */
  includeAdvertiserIds: Array<number>;

  /**
   * Include list for yield group ids that are eligible to be reloaded.
   * The id can be obtained from your google ad manager in the yield_group/list section.
   */
  includeYieldGroupIds: Array<number>;

  /**
   * Include list for orders that are eligible to be reloaded.
   */
  includeOrderIds: Array<number>;

  /**
   * Exclude list for orders that are eligible to be reloaded.
   */
  excludeOrderIds: Array<number>;

  /**
   * Time an ad must be visible before it can be reloaded.
   */
  refreshIntervalMs?: number;

  /**
   * Configures an override for the default refresh interval configured in
   * `refreshIntervalMs` per ad slot.
   */
  refreshIntervalMsOverrides?: RefreshIntervalOverrides;

  /**
   * Configure what defines a user as active / inactive.
   */
  userActivityLevelControl?: UserActivityLevelControl;

  /**
   * Enable reloading ads that are not in viewport. It is not advised to use this option.
   * Impressions are usually only counted on ads that have been 50% visible and it's generally not
   * very user-centric to load stuff that is out of viewport.
   */
  disableAdVisibilityChecks?: boolean;

  /**
   * Overrides the default viewability measurement with a custom target DOM element.
   *
   * This can be used to measure viewability of an ad slot that is not using the default ad slot
   * div container, but creates a separate container on the page. This is the case for certain
   * special ad formats like seedtag's or GumGum's inScreen, YOCs mystery scroller and similar mobile
   * sticky formats.
   *
   * It can also be used to measure viewability for ad skin formats to apply ad reload accordingly.
   *
   */
  viewabilityOverrides?: ViewabilityOverrides;
};

/**
 * This module can be used to refresh ads based on user activity after a certain amount of time that the ad was visible.
 */
export class AdReload implements IModule {
  public readonly name: string = 'moli-ad-reload';
  public readonly description: string = 'Moli implementation of an ad reload module.';
  public readonly moduleType: ModuleType = 'ad-reload';

  private adVisibilityService?: AdVisibilityService;

  /**
   * Default duration after which slots can be refreshed if certain criteria are met (ad visibility duration and
   * other metrics).
   */
  private readonly refreshIntervalMs: number = 20000;

  private logger?: Moli.MoliLogger;
  private getAdPipeline?: () => AdPipeline;
  private requestAdsCalls: number = 0;

  /**
   * Prevents multiple initialization, which would append multiple googletag event listeners.
   */
  private initialized: boolean = false;

  constructor(
    private readonly moduleConfig: AdReloadModuleConfig,
    private readonly window: Window & googletag.IGoogleTagWindow,
    private readonly reloadKeyValue: string = 'native-ad-reload'
  ) {
    if (moduleConfig.refreshIntervalMs) {
      this.refreshIntervalMs = moduleConfig.refreshIntervalMs;
    }
  }

  config(): AdReloadModuleConfig {
    return this.moduleConfig;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  init(moliConfig: Moli.MoliConfig, _: IAssetLoaderService, getAdPipeline: () => AdPipeline): void {
    this.getAdPipeline = getAdPipeline;

    this.logger = getLogger(moliConfig, this.window);

    const slotsToMonitor = moliConfig.slots
      // filter out slots excluded by dom id
      .filter(slot => this.moduleConfig.excludeAdSlotDomIds.indexOf(slot.domId) === -1)
      .map(slot => slot.domId);
    const reloadAdSlotCallback: (slot: googletag.IAdSlot) => void = this.reloadAdSlot(moliConfig);

    this.logger.debug('AdReload', 'monitoring slots', slotsToMonitor);

    // init additional pipeline steps if not already defined
    moliConfig.pipeline = moliConfig.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    // before 'configure', googletag.pubads() is most likely not set. Therefore, we initialize this module as a
    // configure step.
    moliConfig.pipeline.configureSteps.push(
      mkConfigureStep(this.name, context => {
        this.requestAdsCalls = context.requestAdsCalls;

        this.initialize(context, slotsToMonitor, reloadAdSlotCallback);

        return Promise.resolve();
      })
    );
  }

  /**
   * Method is public for testing purposes
   * @param context
   * @param slotsToMonitor
   * @param reloadAdSlotCallback
   */
  initialize = (
    context: AdPipelineContext,
    slotsToMonitor: string[],
    reloadAdSlotCallback: (slot: googletag.IAdSlot) => void
  ) => {
    if (context.env === 'test') {
      context.logger.info('AdReload', 'disabled in environment test');
      return;
    }
    if (this.initialized) {
      return;
    }

    context.logger.debug('AdReload', 'initialize moli ad reload module');

    this.setupAdVisibilityService(
      context.config,
      context.window as unknown as Window & IntersectionObserverWindow & googletag.IGoogleTagWindow
    );
    this.setupSlotRenderListener(slotsToMonitor, reloadAdSlotCallback, context.window);

    this.initialized = true;
  };

  private setupAdVisibilityService = (
    moliConfig: Moli.MoliConfig,
    _window: Window & IntersectionObserverWindow & googletag.IGoogleTagWindow
  ): void => {
    this.adVisibilityService = new AdVisibilityService(
      new UserActivityService(_window, this.moduleConfig.userActivityLevelControl, this.logger),
      this.refreshIntervalMs,
      this.moduleConfig.refreshIntervalMsOverrides || {},
      false,
      !!this.moduleConfig.disableAdVisibilityChecks,
      this.moduleConfig.viewabilityOverrides || {},
      _window,
      this.logger
    );
  };

  private setupSlotRenderListener = (
    slotsToMonitor: Array<string>,
    reloadAdSlotCallback: (googleTagSlot: googletag.IAdSlot) => void,
    window: Window & googletag.IGoogleTagWindow
  ) =>
    window.googletag.pubads().addEventListener('slotRenderEnded', renderEndedEvent => {
      const {
        slot: googleTagSlot,
        campaignId,
        advertiserId,
        yieldGroupIds,
        isEmpty: slotIsEmpty
      } = renderEndedEvent;
      const slotDomId = googleTagSlot.getSlotElementId();
      const slotIsMonitored = slotsToMonitor.indexOf(slotDomId) > -1;
      const orderIdNotExcluded =
        !campaignId || this.moduleConfig.excludeOrderIds.indexOf(campaignId) === -1;
      const orderIdIncluded =
        !!campaignId && this.moduleConfig.includeOrderIds.indexOf(campaignId) > -1;
      const advertiserIdIncluded =
        !!advertiserId && this.moduleConfig.includeAdvertiserIds.indexOf(advertiserId) > -1;

      const yieldGroupIdIncluded =
        !!yieldGroupIds &&
        this.moduleConfig.includeYieldGroupIds.some(id => yieldGroupIds.indexOf(id) > -1);

      // enable refreshing if
      // - the slot wasn't reported empty by pubads
      // - the slot isn't excluded by dom id blocklist
      // - the campaign id (order id) of this slot is NOT in the order id **excludes**
      // - the campaign id (order id) of this slot is in the order id **includes**
      // - OR advertiser id is in advertiser id includes
      const trackingSlotAllowed =
        !slotIsEmpty &&
        slotIsMonitored &&
        orderIdNotExcluded &&
        (orderIdIncluded || advertiserIdIncluded || yieldGroupIdIncluded);

      if (!trackingSlotAllowed) {
        // log details why this slot can't be refreshed.
        this.logTrackingDisallowedReason(
          slotDomId,
          {
            slotIsEmpty,
            slotIsMonitored,
            orderIdNotExcluded,
            orderIdIncluded,
            advertiserIdIncluded,
            yieldGroupIdIncluded
          },
          yieldGroupIds,
          campaignId,
          advertiserId
        );
      }

      // if we already tracked the slot before, then this slotRenderEnded event was probably the one from an ad reload.
      const slotAlreadyTracked = !!this.adVisibilityService?.isSlotTracked(slotDomId);

      if (trackingSlotAllowed) {
        // add tracking for non-excluded slots
        this.adVisibilityService!.trackSlot(googleTagSlot, reloadAdSlotCallback, advertiserId);
      } else if (slotAlreadyTracked) {
        this.adVisibilityService!.removeSlotTracking(googleTagSlot);
      }
    });

  private reloadAdSlot = (moliConfig: Moli.MoliConfig) => (googleTagSlot: googletag.IAdSlot) => {
    const slotId = googleTagSlot.getSlotElementId();
    const moliSlot = moliConfig.slots.find(moliSlot => moliSlot.domId === slotId);
    const adPipeline = this.getAdPipeline && this.getAdPipeline();

    if (moliSlot && adPipeline) {
      this.logger?.debug('AdReload', 'fired slot reload', moliSlot.domId);

      const slotWithOptimizedSizes = this.maybeOptimizeSlotForCls(moliSlot, googleTagSlot);

      googleTagSlot.setTargeting(this.reloadKeyValue, 'true');

      adPipeline.run(
        [slotWithOptimizedSizes],
        {
          ...moliConfig,
          slots: [
            ...moliConfig.slots.filter(({ domId }) => domId !== slotId),
            slotWithOptimizedSizes
          ]
        },
        this.requestAdsCalls
      );
    }
  };

  /**
   * If the given ad slot should be optimized for low CLS, filters the slot's sizes to only contain
   * any sizes featuring a smaller or equal height compared to the previously displayed ad. This
   * prevents layout shifts caused by a bigger slot height replacing a smaller one.
   *
   * *SIDE EFFECT*: If the slot should be optimized, a height style property matching the previous
   * height will be set on the slot's DOM element to prevent flicker during the reload.
   *
   * *SIDE EFFECT*: If the slot should be reloaded with fewer sizes due to height restrictions, the
   * googletag slot pendant will be destroyed and rebuilt.
   */
  private maybeOptimizeSlotForCls = (
    moliSlot: Moli.AdSlot,
    googleTagSlot: googletag.IAdSlot
  ): Moli.AdSlot => {
    const slotDomId = moliSlot.domId;

    if (this.moduleConfig.optimizeClsScoreDomIds.indexOf(slotDomId) > -1) {
      const slotDomElement = this.window.document.getElementById(slotDomId);
      if (slotDomElement && !!slotDomElement.style) {
        const slotHeight = slotDomElement.scrollHeight;
        slotDomElement.style.setProperty('height', `${slotHeight}px`);

        const newSlotSizes = moliSlot.sizes.filter(
          size => size !== 'fluid' && size[1] <= slotHeight
        );

        this.logger?.debug(
          'AdReload',
          `CLS optimization: slot ${slotDomId} received fixed height ${slotHeight}px`,
          'new sizes:',
          newSlotSizes
        );

        if (newSlotSizes.length < moliSlot.sizes.filter(size => size !== 'fluid').length) {
          this.window.googletag.destroySlots([googleTagSlot]);
        }

        return {
          ...moliSlot,
          sizes: newSlotSizes
        };
      }

      this.logger?.warn(
        'AdReload',
        `CLS optimization: slot ${slotDomId} to be optimized but not found in DOM.`
      );
    }

    return moliSlot;
  };

  private logTrackingDisallowedReason = (
    slotDomId: string,
    reasons: {
      slotIsEmpty: boolean;
      slotIsMonitored: boolean;
      orderIdNotExcluded: boolean;
      orderIdIncluded: boolean;
      advertiserIdIncluded: boolean;
      yieldGroupIdIncluded: boolean;
    },
    yieldGroupIds: null | number[],
    campaignId?: number,
    advertiserId?: number
  ): void => {
    const {
      slotIsEmpty,
      slotIsMonitored,
      orderIdNotExcluded,
      orderIdIncluded,
      advertiserIdIncluded,
      yieldGroupIdIncluded
    } = reasons;
    if (slotIsEmpty) {
      this.logger?.debug('AdReload', slotDomId, 'slot not tracked: reported empty');
    }
    if (!slotIsMonitored) {
      this.logger?.debug('AdReload', slotDomId, 'slot not tracked: excluded by DOM id');
    }
    if (!orderIdNotExcluded) {
      this.logger?.debug(
        'AdReload',
        slotDomId,
        'slot not tracked: excluded by order id',
        campaignId
      );
    }
    if (!(orderIdIncluded || advertiserIdIncluded || yieldGroupIdIncluded)) {
      this.logger?.debug(
        'AdReload',
        slotDomId,
        'slot not tracked: neither order id',
        campaignId,
        'nor advertiser id',
        advertiserId,
        'nor yieldGroup id',
        yieldGroupIds,
        'included'
      );
    }
  };
}
