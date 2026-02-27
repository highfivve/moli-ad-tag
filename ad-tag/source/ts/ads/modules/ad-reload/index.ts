/**
 * Moli's own Ad Reload solution to optimize long lived user sessions by reloading
 * specific ad slots.
 *
 * ## Integration
 *
 * In your `index.ts`, import AdReload and register the module.
 *
 * ```js
 * import { createAdReload } from '@highfivve/module-moli-ad-reload';
 *
 * moli.registerModule(createAdReload());
 * ```
 *
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

export interface IAdReloadModule extends IModule {
  isInitialized(): boolean;
  initialize(
    context: AdPipelineContext,
    config: modules.adreload.AdReloadModuleConfig,
    slotsToMonitor: string[],
    reloadAdSlotCallback: (slot: googletag.IAdSlot) => void
  ): void;
  readonly adVisibilityService: AdVisibilityService | undefined;
}

/**
 * This module can be used to refresh ads based on user activity after a certain amount of time that the ad was visible.
 */
export const createAdReload = (): IAdReloadModule => {
  const name = 'moli-ad-reload';

  /**
   * Default duration after which slots can be refreshed if certain criteria are met (ad visibility duration and
   * other metrics).
   */
  const defaultRefreshIntervalMs: number = 20000;

  /**
   * Default ad reload key
   */
  const reloadKeyValue: string = 'native-ad-reload';

  /**
   * Prevents multiple initialization, which would append multiple googletag event listeners.
   */
  let initialized: boolean = false;

  let moduleConfig: modules.adreload.AdReloadModuleConfig | null = null;
  let adVisibilityService: AdVisibilityService | undefined;

  const config__ = (): modules.adreload.AdReloadModuleConfig | null => moduleConfig;

  const isInitialized = (): boolean => initialized;

  const configure__ = (mConfig?: modules.ModulesConfig) => {
    if (mConfig?.adReload?.enabled) {
      moduleConfig = mConfig.adReload;
    }
  };

  const initSteps__ = (): InitStep[] => [];

  const setupAdVisibilityService = (
    config: modules.adreload.AdReloadModuleConfig,
    window: Window & IntersectionObserverWindow & googletag.IGoogleTagWindow,
    logger: MoliRuntime.MoliLogger
  ): void => {
    adVisibilityService = new AdVisibilityService(
      new UserActivityService(window, config.userActivityLevelControl, logger),
      // use the refresh interval from the config if provided, otherwise use the default one
      config.refreshIntervalMs ?? defaultRefreshIntervalMs,
      config.refreshIntervalMsOverrides ?? {},
      false,
      !!config.disableAdVisibilityChecks,
      config.viewabilityOverrides ?? {},
      window,
      logger
    );
  };

  const logTrackingDisallowedReason = (
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

  const maybeOptimizeSlotForCls = (
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

  const reloadAdSlot =
    (config: modules.adreload.AdReloadModuleConfig, ctx: AdPipelineContext) =>
    (googleTagSlot: googletag.IAdSlot) => {
      const slotId = googleTagSlot.getSlotElementId();
      const moliSlot = ctx.config__.slots.find(moliSlot => moliSlot.domId === slotId);

      if (moliSlot && moliSlot.behaviour.loaded !== 'infinite') {
        ctx.logger__.debug('AdReload', 'fired slot reload', moliSlot.domId);

        const sizesOverride: googleAdManager.SlotSize[] = maybeOptimizeSlotForCls(
          config,
          moliSlot,
          googleTagSlot,
          ctx.logger__,
          ctx.window__
        );

        googleTagSlot.setTargeting(reloadKeyValue, 'true');

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

  const setupSlotRenderListener = (
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
        logTrackingDisallowedReason(
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
      const slotAlreadyTracked = !!adVisibilityService?.isSlotTracked(slotDomId);

      if (trackingSlotAllowed) {
        // add tracking for non-excluded slots
        adVisibilityService!.trackSlot(
          googleTagSlot,
          reloadAdSlotCallback,
          advertiserId,
          companyIds
        );
      } else if (slotAlreadyTracked) {
        adVisibilityService!.removeSlotTracking(googleTagSlot);
      }
    });

  /**
   * Method is public for testing purposes
   */
  const initialize = (
    context: AdPipelineContext,
    config: modules.adreload.AdReloadModuleConfig,
    slotsToMonitor: string[],
    reloadAdSlotCallback: (slot: googletag.IAdSlot) => void
  ) => {
    if (context.env__ === 'test') {
      context.logger__.info('AdReload', 'disabled in environment test');
      return;
    }
    if (initialized) {
      return;
    }

    context.logger__.debug('AdReload', 'initialize moli ad reload module');

    setupAdVisibilityService(
      config,
      context.window__ as unknown as Window &
        IntersectionObserverWindow &
        googletag.IGoogleTagWindow,
      context.logger__
    );
    setupSlotRenderListener(
      config,
      slotsToMonitor,
      reloadAdSlotCallback,
      context.window__,
      context.logger__
    );

    initialized = true;
  };

  const configureSteps__ = (): ConfigureStep[] => {
    const config = moduleConfig;
    return config
      ? [
          mkConfigureStep(name, context => {
            const slotsToMonitor = context.config__.slots
              // filter out slots excluded by dom id
              .filter(slot => config.excludeAdSlotDomIds.indexOf(slot.domId) === -1)
              .map(slot => slot.domId)
              .filter(isNotNull);

            const reloadAdSlotCallback: (slot: googletag.IAdSlot) => void = reloadAdSlot(
              config,
              context
            );

            context.logger__.debug('AdReload', 'monitoring slots', slotsToMonitor);
            initialize(context, config, slotsToMonitor, reloadAdSlotCallback);

            return Promise.resolve();
          })
        ]
      : [];
  };

  const prepareRequestAdsSteps__ = (): PrepareRequestAdsStep[] => [];

  return {
    name,
    description: 'Moli implementation of an ad reload module.',
    moduleType: 'ad-reload' as ModuleType,
    config__,
    configure__,
    initSteps__,
    configureSteps__,
    prepareRequestAdsSteps__,
    isInitialized,
    initialize,
    get adVisibilityService() {
      return adVisibilityService;
    }
  };
};
