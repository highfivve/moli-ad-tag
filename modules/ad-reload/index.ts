import {
  AdPipeline,
  googletag,
  IAssetLoaderService,
  IModule,
  mkConfigureStep,
  ModuleType,
  Moli
} from '@highfivve/ad-tag';

import { AdVisibilityService } from './adVisibilityService';
import { UserActivityService } from './userActivityService';

type AdReloadModuleConfig = {
  excludeAdSlotDomIds: Array<string>;
  includeAdvertiserIds: Array<number>;
  includeOrderIds: Array<number>;
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

  private adPipeline: AdPipeline | undefined;
  private requestAdsCalls: number = 0;

  constructor(private readonly moduleConfig: AdReloadModuleConfig) {
    if (moduleConfig.refreshIntervalMs) {
      this.refreshIntervalMs = moduleConfig.refreshIntervalMs;
    }
  }

  config(): AdReloadModuleConfig {
    return this.moduleConfig;
  }

  init(moliConfig: Moli.MoliConfig, _: IAssetLoaderService, adPipeline: AdPipeline): void {
    this.adPipeline = adPipeline;

    const reloadAdSlotCallback: (slot: googletag.IAdSlot) => void = this.reloadAdSlot(moliConfig);

    // init additional pipeline steps if not already defined
    moliConfig.pipeline = moliConfig.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    moliConfig.pipeline.configureSteps.push(
      mkConfigureStep(this.name, (context, moliSlots) => {
        const slotsToMonitor = moliSlots
          // filter out slots excluded by dom id
          .filter(slot => this.moduleConfig.excludeAdSlotDomIds.indexOf(slot.domId) === -1)
          .map(slot => slot.domId);

        this.setupAdVisibilityService(moliConfig, context.window);
        this.setupSlotRenderListener(slotsToMonitor, reloadAdSlotCallback, context.window);

        return Promise.resolve();
      })
    );
  }

  private setupAdVisibilityService = (moliConfig: Moli.MoliConfig, window: Window) =>
    (this.adVisibilityService = new AdVisibilityService(
      new UserActivityService(window, moliConfig.logger),
      this.refreshIntervalMs,
      false,
      window,
      moliConfig.logger
    ));

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

      // enable refreshing if
      // - the slot is not yet tracked by the AdVisibilityService
      // - the campaign id (order id) of this slot is in the order id includes
      // - OR advertiser id is in advertiser id includes
      const trackingSlotAllowed =
        !slotIsEmpty &&
        slotIsMonitored &&
        ((campaignId && this.moduleConfig.includeOrderIds.indexOf(campaignId) > -1) ||
          (advertiserId && this.moduleConfig.includeAdvertiserIds.indexOf(advertiserId) > -1));

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

    if (moliSlot) {
      googleTagSlot.setTargeting('sovrn-reload', 'true');
      this.adPipeline?.run([moliSlot], moliConfig, ++this.requestAdsCalls);
    }
  };
}
