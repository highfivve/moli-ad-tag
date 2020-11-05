import {
  AdPipeline,
  AdPipelineContext,
  getLogger,
  googletag,
  IAssetLoaderService,
  IModule,
  mkConfigureStep,
  ModuleType,
  Moli
} from '@highfivve/ad-tag';

import { AdVisibilityService } from './adVisibilityService';
import { UserActivityService } from './userActivityService';
import { a9ClearTargetingStep } from '@highfivve/ad-tag/lib/source/ts/ads/a9';

type AdReloadModuleConfig = {
  excludeAdSlotDomIds: Array<string>;
  includeAdvertiserIds: Array<number>;
  includeOrderIds: Array<number>;
  excludeOrderIds: Array<number>;
  refreshIntervalMs?: number;
};

/**
 * This module can be used to refresh ads based on user activity after a certain amount of time that the ad was visible.
 */
export default class AdReload implements IModule {
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
    private readonly window: Window,
    private readonly reloadKeyValue: string = 'native-ad-reload'
  ) {
    if (moduleConfig.refreshIntervalMs) {
      this.refreshIntervalMs = moduleConfig.refreshIntervalMs;
    }
  }

  config(): AdReloadModuleConfig {
    return this.moduleConfig;
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

        this.initialize(moliConfig, context, slotsToMonitor, reloadAdSlotCallback);

        return Promise.resolve();
      })
    );

    moliConfig.pipeline.prepareRequestAdsSteps.push(
      // clear a9 targeting so they can set it again automagically if needed
      a9ClearTargetingStep()
    );
  }

  private initialize = (
    moliConfig: Moli.MoliConfig,
    context: AdPipelineContext,
    slotsToMonitor: Array<string>,
    reloadAdSlotCallback: (slot: googletag.IAdSlot) => void
  ) => {
    if (this.initialized) {
      return;
    }

    this.logger?.debug('AdReload', 'initialize moli ad reload module');

    this.setupAdVisibilityService(moliConfig, context.window);
    this.setupSlotRenderListener(slotsToMonitor, reloadAdSlotCallback, context.window);

    this.initialized = true;
  };

  private setupAdVisibilityService = (moliConfig: Moli.MoliConfig, window: Window): void => {
    this.adVisibilityService = new AdVisibilityService(
      new UserActivityService(window, this.logger),
      this.refreshIntervalMs,
      false,
      window,
      this.logger
    );
  };

  private setupSlotRenderListener = (
    slotsToMonitor: Array<string>,
    reloadAdSlotCallback: (googleTagSlot: googletag.IAdSlot) => void,
    window: Window
  ) =>
    window.googletag.pubads().addEventListener('slotRenderEnded', renderEndedEvent => {
      const {
        slot: googleTagSlot,
        campaignId,
        advertiserId,
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
        (orderIdIncluded || advertiserIdIncluded);

      if (!trackingSlotAllowed) {
        // log details why this slot can't be refreshed.
        this.logTrackingDisallowedReason(
          slotDomId,
          {
            slotIsEmpty,
            slotIsMonitored,
            orderIdNotExcluded,
            orderIdIncluded,
            advertiserIdIncluded
          },
          campaignId,
          advertiserId
        );
      }

      // if we already tracked the slot before, then this slotRenderEnded event was probably the one from an ad reload.
      const slotAlreadyTracked = !!this.adVisibilityService?.isSlotTracked(slotDomId);

      if (trackingSlotAllowed) {
        // add tracking for non-excluded slots
        this.adVisibilityService!.trackSlot(googleTagSlot, reloadAdSlotCallback);
      } else if (slotAlreadyTracked) {
        this.adVisibilityService!.removeSlotTracking(googleTagSlot);
      }
    });

  private reloadAdSlot = (moliConfig: Moli.MoliConfig) => (googleTagSlot: googletag.IAdSlot) => {
    const moliSlot = moliConfig.slots.find(
      moliSlot => moliSlot.domId === googleTagSlot.getSlotElementId()
    );
    const adPipeline = this.getAdPipeline && this.getAdPipeline();

    if (moliSlot && adPipeline) {
      this.logger?.debug('AdReload', 'fired slot reload', moliSlot.domId);

      googleTagSlot.setTargeting(this.reloadKeyValue, 'true');

      adPipeline.run([moliSlot], moliConfig, this.requestAdsCalls);
    }
  };

  private logTrackingDisallowedReason = (
    slotDomId: string,
    reasons: {
      slotIsEmpty: boolean;
      slotIsMonitored: boolean;
      orderIdNotExcluded: boolean;
      orderIdIncluded: boolean;
      advertiserIdIncluded: boolean;
    },
    campaignId?: number,
    advertiserId?: number
  ): void => {
    const {
      slotIsEmpty,
      slotIsMonitored,
      orderIdNotExcluded,
      orderIdIncluded,
      advertiserIdIncluded
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
    if (!(orderIdIncluded || advertiserIdIncluded)) {
      this.logger?.debug(
        'AdReload',
        slotDomId,
        'slot not tracked: neither order id',
        campaignId,
        'nor advertiser id',
        advertiserId,
        'included'
      );
    }
  };
}
