import { IModule, ModuleType, googletag, Moli, prebidjs } from '@highfivve/ad-tag';
import { getLogger } from '@highfivve/ad-tag/source/ts/util/logging';
import { IAssetLoaderService } from '@highfivve/ad-tag/source/ts/util/assetLoaderService';

interface IJustPremiumConfig {

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

export default class JustPremium implements IModule {

  public readonly name: string = 'JustPremium';
  public readonly description: string = 'Block other ad slots if a wallpaper has won the auction';
  public readonly moduleType: ModuleType = 'prebid';

  constructor(private readonly justPremiumConfig: IJustPremiumConfig, private readonly window: Window) {
  }

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
    this.window.googletag.destroySlots(adSlot);
  };

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    const log = getLogger(config, this.window);
    if (!config.prebid) {
      log.error('JustPremiumModule', 'Prebid isn\'t configured!');
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
      log.error('JustPremiumModule', 'Couldn\'t find one or more ids in the ad slot config:', domIds);
      return;
    }

    let prebidListener = config.prebid!.listener;
    if (prebidListener) {
      log.error('JustPremiumModule', 'Couldn\'t define prebidListener, because there was already set one.');
      return;
    }

    config.prebid!.listener = {
      preSetTargetingForGPTAsync: (bidResponses, timedOut, slotDefinitions) => {

        if (this.checkForJustPremiumWallpaper(bidResponses)) {
          this.justPremiumConfig.blockedAdSlotDomIds.forEach(this.destroyAdSlot(slotDefinitions));

          try {
            const wallpaperDiv = document.getElementById(this.justPremiumConfig.wallpaperAdSlotDomId);
            if (this.justPremiumConfig.hideWallpaperAdSlot && wallpaperDiv) {
              wallpaperDiv.style.setProperty('display', 'none');
            }
          } catch (e) {
            log.error('JustPremiumModule', `Couldn't set the the wallpaper div ${this.justPremiumConfig.wallpaperAdSlotDomId} to display:none;`, e);
          }

        }
      }
    };

  }

}
