import { IModule, ModuleType, googletag, Moli, prebidjs } from '@highfivve/ad-tag';
import { getLogger } from '@highfivve/ad-tag/source/ts/util/logging';
import { IAssetLoaderService } from '@highfivve/ad-tag/source/ts/util/assetLoaderService';

interface ISkinConfig {

  /**
   * This is usually the dom id of the header ad slot.
   *
   * Some setups may have an ad slot only for the just premium skin.
   * This is the case if there are direct campaign formats for wallpapers
   * that require a DFP road block.
   */
  wallpaperAdSlotDomId: string;

  /**
   * dom ids of the ad slots that should not be requested when a just premium
   * skin appears in the bid responses.
   *
   * Depending on the wallpaperAdSlot these are usually skyscrapers left and right
   * and if there's a specific wallpaper ad slot the header as well.
   */
  blockedAdSlotDomIds: string[];

  /**
   * if true, the ad slot will be set to display none
   */
  hideWallpaperAdSlot: boolean;
}

export default class Skin implements IModule {

  public readonly name: string = 'Skin';
  public readonly description: string = 'Block other ad slots if a wallpaper has won the auction';
  public readonly moduleType: ModuleType = 'prebid';

  constructor(private readonly skinConfig: ISkinConfig, private readonly window: Window) {
  }

  config(): Object | null {
    return this.skinConfig;
  }

  /**
   * Checks if bid responses contains a JustPremium bid that has the wallpaper format or a DSPX bid
   * @param bidResponses the prebid bid response from a prebid request
   */
  checkForWallpaper = (bidResponses: prebidjs.IBidResponsesMap): boolean => {
    const wallpaperDomId = this.skinConfig.wallpaperAdSlotDomId;

    const wallpaperBidResponse = bidResponses[wallpaperDomId];
    const justPremiumWallpaperBid = wallpaperBidResponse ?
      wallpaperBidResponse.bids.filter((bid: prebidjs.BidResponse) => {
        return bid.cpm > 0 && (
          (bid.bidder === prebidjs.JustPremium && bid.format === prebidjs.JustPremiumWallpaper) ||
          (bid.bidder === prebidjs.DSPX)
        );
      }) : [];
    return justPremiumWallpaperBid.length !== 0;
  };

  /**
   * Destroy the slot defined by the give DOM ID.
   *
   * NOTE: Accesses the global gpt.js tag (window.googletag).
   *
   * @param slotDefinitions all available slots
   * @return function that destroys a given adSlot by domId
   */
  destroyAdSlot = (slotDefinitions: Moli.SlotDefinition<Moli.AdSlot>[]) => (adSlotDomId: string): void => {
    const adSlot = slotDefinitions.map(slot => slot.adSlot)
      .filter((slot: googletag.IAdSlot) => slot.getSlotElementId() === adSlotDomId);
    this.window.googletag.destroySlots(adSlot);
  };

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    const log = getLogger(config, this.window);
    if (!config.prebid) {
      log.error('SkinModule', 'Prebid isn\'t configured!');
      return;
    }

    const domIds = this.skinConfig.blockedAdSlotDomIds.concat(this.skinConfig.wallpaperAdSlotDomId)
      .filter(domId => !config.slots.some(slot => slot.domId === domId));

    if (domIds.length > 0) {
      log.error('SkinModule', 'Couldn\'t find one or more ids in the ad slot config:', domIds);
      return;
    }

    const prebidListener = config.prebid.listener;
    if (prebidListener) {
      log.error('SkinModule', 'Couldn\'t define prebidListener, because there was already set one.');
      return;
    }

    config.prebid.listener = {
      preSetTargetingForGPTAsync: (bidResponses, timedOut, slotDefinitions) => {

        if (this.checkForWallpaper(bidResponses)) {
          this.skinConfig.blockedAdSlotDomIds.forEach(this.destroyAdSlot(slotDefinitions));

          try {
            const wallpaperDiv = document.getElementById(this.skinConfig.wallpaperAdSlotDomId);
            if (this.skinConfig.hideWallpaperAdSlot && wallpaperDiv) {
              wallpaperDiv.style.setProperty('display', 'none');
            }
          } catch (e) {
            log.error('SkinModule', `Couldn't set the the wallpaper div ${this.skinConfig.wallpaperAdSlotDomId} to display:none;`, e);
          }

        }
      }
    };

  }

}
