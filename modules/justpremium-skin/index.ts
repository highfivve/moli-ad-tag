import {IModule, ModuleType, googletag, Moli, prebidjs} from '@highfivve/ad-tag';
import {getLogger} from '@highfivve/ad-tag/source/ts/util/logging';

interface IJustPremiumConfig {
  wallpaperAdSlotDomId: string;
  blockedAdSlotDomIds: string[];
}

export default class JustPremium implements IModule {

  public readonly name: string = 'JustPremium';
  public readonly description: string = 'Block other ad slots if a wallpaper has won the auction';
  public readonly moduleType: ModuleType = 'prebid';

  constructor(private readonly justPremiumConfig: IJustPremiumConfig) {}

  config(): Object | null {
    return this.justPremiumConfig;
  }

  /**
   * Checks if bid responses contain a JustPremium bid that has the wallpaper format
   * @param bidResponses the prebid bid response from a prebid request
   */
  checkForJustPremiumWallpaper = (bidResponses: prebidjs.IBidResponsesMap): boolean => {
    const justPremiumWallpaperDomId = this.justPremiumConfig.wallpaperAdSlotDomId;

    const adPresenterDesktop = bidResponses[justPremiumWallpaperDomId];
    const justPremiumWallpaperBid = adPresenterDesktop ?
      adPresenterDesktop.bids.filter((presenterBid: prebidjs.BidResponse) => {
        return presenterBid.bidder === prebidjs.JustPremium && presenterBid.format === prebidjs.JustPremiumWallpaper && presenterBid.cpm > 0;
      }) : [];
    return justPremiumWallpaperBid.length !== 0;
  };

  /**
   * Destroy the slot defined by the give DOM ID.
   *
   * NOTE: Accesses the global gpt.js tag (window.googletag).
   *
   * @param slotDefinitions all available slots
   * @param adSlotDomId the DOM id of the ad slot. Used to remove the slot
   */
  destroyAdSlot = (slotDefinitions: Moli.SlotDefinition<Moli.AdSlot>[]) => (adSlotDomId: string): void => {
    const adSlot = slotDefinitions.map(slot => slot.adSlot)
      .filter((slot: googletag.IAdSlot) => slot.getSlotElementId() === adSlotDomId);
    window.googletag.destroySlots(adSlot);
  };

  init(config: Moli.MoliConfig): void {
    const log = getLogger(config, window);
    if (!config.prebid) {
      log.error('Prebid isn\'t configured!');
      return;
    }

    let domIds = this.justPremiumConfig.blockedAdSlotDomIds.concat(this.justPremiumConfig.wallpaperAdSlotDomId);

    config.slots.some(value => {
      let index = domIds.indexOf(value.domId);
      if (index > -1) {
        domIds.splice(index, 1);
      }
    });

    if (domIds.length > 0) {
      log.error('Couldn\'t find one or more ids in the ad slot config:', domIds);
      return;
    }

    let prebidListener = config.prebid!.listener;
    if (prebidListener) {
      log.error('Couldn\'t define prebidListener, because there was already set one.');
      return;
    }

    config.prebid!.listener = {
      preSetTargetingForGPTAsync: (bidResponses, timedOut, slotDefinitions) => {

        if (this.checkForJustPremiumWallpaper(bidResponses)) {
          this.justPremiumConfig.blockedAdSlotDomIds.forEach(this.destroyAdSlot(slotDefinitions));
        }
      }
    };

  }

}
