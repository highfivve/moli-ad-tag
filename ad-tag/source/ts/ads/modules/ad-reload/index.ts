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
import { AdVisibilityService } from './adVisibilityService';
import { UserActivityService } from './userActivityService';
import { IModule, ModuleType } from 'ad-tag/types/module';
import { googletag } from 'ad-tag/types/googletag';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkConfigureStep,
  PrepareRequestAdsStep
} from '../../adPipeline';
import { AdSlot, googleAdManager, modules } from 'ad-tag/types/moliConfig';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { IntersectionObserverWindow } from 'ad-tag/types/dom';
import { isNotNull } from 'ad-tag/util/arrayUtils';
import { isAdvertiserIncluded } from 'ad-tag/ads/isAdvertiserIncluded';
/**
 * This module can be used to refresh ads based on user activity after a certain amount of time that the ad was visible.
 */
export class AdReload implements IModule {
  public readonly name: string = 'moli-ad-reload';
  public readonly description: string = 'Moli implementation of an ad reload module.';
  public readonly moduleType: ModuleType = 'ad-reload';

  private moduleConfig: modules.adreload.AdReloadModuleConfig | null = null;

  private adVisibilityService?: AdVisibilityService;

  /**
   * Default duration after which slots can be refreshed if certain criteria are met (ad visibility duration and
   * other metrics).
   */
  private readonly refreshIntervalMs: number = 20000;

  /**
   * Default ad reload key
   * @private
   */
  private readonly reloadKeyValue: string = 'native-ad-reload';

  /**
   * Prevents multiple initialization, which would append multiple googletag event listeners.
   */
  private initialized: boolean = false;

  config__(): modules.adreload.AdReloadModuleConfig | null {
    return this.moduleConfig;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  configure__(moduleConfig?: modules.ModulesConfig) {
    if (moduleConfig?.adReload?.enabled) {
      this.moduleConfig = moduleConfig.adReload;
    }
  }

  initSteps__(): InitStep[] {
    return [];
  }

  configureSteps__(): ConfigureStep[] {
    const config = this.moduleConfig;
    return config
      ? [
          mkConfigureStep(this.name, context => {
            const slotsToMonitor = context.config__.slots
              // filter out slots excluded by dom id
              .filter(slot => config.excludeAdSlotDomIds.indexOf(slot.domId) === -1)
              .map(slot => slot.domId)
              .filter(isNotNull);

            const reloadAdSlotCallback: (slot: googletag.IAdSlot) => void = this.reloadAdSlot(
              config,
              context
            );

            context.logger__.debug('AdReload', 'monitoring slots', slotsToMonitor);
            this.initialize(context, config, slotsToMonitor, reloadAdSlotCallback);

            return Promise.resolve();
          })
        ]
      : [];
  }

  prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
    return [];
  }

  /**
   * Method is public for testing purposes
   * @param context
   * @param config
   * @param slotsToMonitor
   * @param reloadAdSlotCallback
   */
  initialize = (
    context: AdPipelineContext,
    config: modules.adreload.AdReloadModuleConfig,
    slotsToMonitor: string[],
    reloadAdSlotCallback: (slot: googletag.IAdSlot) => void
  ) => {
    if (context.env__ === 'test') {
      context.logger__.info('AdReload', 'disabled in environment test');
      return;
    }
    if (this.initialized) {
      return;
    }

    context.logger__.debug('AdReload', 'initialize moli ad reload module');

    this.setupAdVisibilityService(
      config,
      context.window__ as unknown as Window &
        IntersectionObserverWindow &
        googletag.IGoogleTagWindow,
      context.logger__
    );
    this.setupSlotRenderListener(
      config,
      slotsToMonitor,
      reloadAdSlotCallback,
      context.window__,
      context.logger__
    );

    this.initialized = true;
  };

  private setupAdVisibilityService = (
    config: modules.adreload.AdReloadModuleConfig,
    window: Window & IntersectionObserverWindow & googletag.IGoogleTagWindow,
    logger: MoliRuntime.MoliLogger
  ): void => {
    this.adVisibilityService = new AdVisibilityService(
      new UserActivityService(window, config.userActivityLevelControl, logger),
      this.refreshIntervalMs,
      config.refreshIntervalMsOverrides ?? {},
      false,
      !!config.disableAdVisibilityChecks,
      config.viewabilityOverrides ?? {},
      window,
      logger
    );
  };

  private setupSlotRenderListener = (
    config: modules.adreload.AdReloadModuleConfig,
    slotsToMonitor: string[],
    reloadAdSlotCallback: (googleTagSlot: googletag.IAdSlot) => void,
    window: Window & googletag.IGoogleTagWindow,
    logger: MoliRuntime.MoliLogger
  ) =>
    window.googletag.pubads().addEventListener('slotRenderEnded', renderEndedEvent => {
      const {
        slot: googleTagSlot,
        campaignId,
        advertiserId,
        companyIds,
        yieldGroupIds,
        isEmpty: slotIsEmpty
      } = renderEndedEvent;
      const slotDomId = googleTagSlot.getSlotElementId();
      const slotIsMonitored = slotsToMonitor.indexOf(slotDomId) > -1;
      const orderIdNotExcluded = !campaignId || config.excludeOrderIds.indexOf(campaignId) === -1;
      const orderIdIncluded = !!campaignId && config.includeOrderIds.indexOf(campaignId) > -1;
      const advertiserIdIncluded = isAdvertiserIncluded(
        renderEndedEvent,
        config.includeAdvertiserIds
      );

      const yieldGroupIdIncluded =
        !!yieldGroupIds && config.includeYieldGroupIds.some(id => yieldGroupIds.indexOf(id) > -1);

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
          logger,
          yieldGroupIds,
          campaignId,
          advertiserId
        );
      }

      // if we already tracked the slot before, then this slotRenderEnded event was probably the one from an ad reload.
      const slotAlreadyTracked = !!this.adVisibilityService?.isSlotTracked(slotDomId);

      if (trackingSlotAllowed) {
        // add tracking for non-excluded slots
        this.adVisibilityService!.trackSlot(
          googleTagSlot,
          reloadAdSlotCallback,
          advertiserId,
          companyIds
        );
      } else if (slotAlreadyTracked) {
        this.adVisibilityService!.removeSlotTracking(googleTagSlot);
      }
    });

  private reloadAdSlot =
    (config: modules.adreload.AdReloadModuleConfig, ctx: AdPipelineContext) =>
    (googleTagSlot: googletag.IAdSlot) => {
      const slotId = googleTagSlot.getSlotElementId();
      const moliSlot = ctx.config__.slots.find(moliSlot => moliSlot.domId === slotId);

      if (moliSlot && moliSlot.behaviour.loaded !== 'infinite') {
        ctx.logger__.debug('AdReload', 'fired slot reload', moliSlot.domId);

        const sizesOverride: googleAdManager.SlotSize[] = this.maybeOptimizeSlotForCls(
          config,
          moliSlot,
          googleTagSlot,
          ctx.logger__,
          ctx.window__
        );

        googleTagSlot.setTargeting(this.reloadKeyValue, 'true');

        const getBucketAndLoadingBehaviour = () => {
          const bucketOverride = config.viewabilityOverrides?.[slotId]?.refreshBucket;
          if (bucketOverride === true) {
            const loaded = moliSlot.behaviour.loaded;
            const bucket = moliSlot.behaviour.bucket;
            const bucketName =
              typeof bucket === 'string'
                ? bucket
                : bucket?.[ctx.labelConfigService__.getDeviceLabel()];
            return bucketName && loaded !== 'infinite' ? { name: bucketName, loaded } : undefined;
          }
        };

        const bucket = getBucketAndLoadingBehaviour();

        if (bucket) {
          ctx.window__.moli
            .refreshBucket(bucket.name, { loaded: bucket.loaded })
            .then(result =>
              ctx.logger__.debug('AdReload', `refreshBucket '${bucket.name}' result`, result)
            )
            .catch(error =>
              ctx.logger__.error('AdReload', `refreshBucket '${bucket.name}' failed`, error)
            );
        } else {
          ctx.window__.moli
            .refreshAdSlot(slotId, {
              loaded: moliSlot.behaviour.loaded,
              ...(sizesOverride && { sizesOverride: sizesOverride })
            })
            .catch(error => ctx.logger__.error('AdReload', `refreshing ${slotId} failed`, error));
        }
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
    config: modules.adreload.AdReloadModuleConfig,
    moliSlot: AdSlot,
    googleTagSlot: googletag.IAdSlot,
    logger: MoliRuntime.MoliLogger,
    _window: Window & googletag.IGoogleTagWindow
  ): googleAdManager.SlotSize[] => {
    const slotDomId = moliSlot.domId;

    if (config.optimizeClsScoreDomIds.indexOf(slotDomId) > -1) {
      const slotDomElement = _window.document.getElementById(slotDomId);
      if (slotDomElement && !!slotDomElement.style) {
        const slotHeight = slotDomElement.scrollHeight;
        slotDomElement.style.setProperty('height', `${slotHeight}px`);

        const newSlotSizes = moliSlot.sizes.filter(
          size => size !== 'fluid' && size[1] <= slotHeight
        );

        logger.debug(
          'AdReload',
          `CLS optimization: slot ${slotDomId} received fixed height ${slotHeight}px`,
          'new sizes:',
          newSlotSizes
        );

        if (newSlotSizes.length < moliSlot.sizes.filter(size => size !== 'fluid').length) {
          _window.googletag.destroySlots([googleTagSlot]);
        }

        return newSlotSizes;
      }

      logger.warn(
        'AdReload',
        `CLS optimization: slot ${slotDomId} to be optimized but not found in DOM.`
      );
    }

    return moliSlot.sizes;
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
    logger: MoliRuntime.MoliLogger,
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
      logger.debug('AdReload', slotDomId, 'slot not tracked: reported empty');
    }
    if (!slotIsMonitored) {
      logger.debug('AdReload', slotDomId, 'slot not tracked: excluded by DOM id');
    }
    if (!orderIdNotExcluded) {
      logger.debug('AdReload', slotDomId, 'slot not tracked: excluded by order id', campaignId);
    }
    if (!(orderIdIncluded || advertiserIdIncluded || yieldGroupIdIncluded)) {
      logger.debug(
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
