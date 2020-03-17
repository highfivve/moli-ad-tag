import { googletag, IModule, ModuleType, Moli, prebidjs } from '@highfivve/ad-tag';
import { getLogger } from '@highfivve/ad-tag/source/ts/util/logging';
import { IAssetLoaderService } from '@highfivve/ad-tag/source/ts/util/assetLoaderService';

interface ISkinModuleConfig {

  /**
   * A list of configurations. The first configuration with matching
   * format filters will be used.
   */
  readonly configs: ISkinConfig[];
}

interface IJustPremiumFormatFilter {
  readonly bidder: typeof prebidjs.JustPremium;

  readonly format: prebidjs.JustPremiumFormat;
}

interface IDSPXFormatFilter {
  readonly bidder: typeof prebidjs.DSPX;
}

type FormatFilter = IJustPremiumFormatFilter | IDSPXFormatFilter;

export interface ISkinConfig {

  /**
   * A list of filters. If one of the filter applies then this
   * configuration will be executed.
   */
  readonly formatFilter: FormatFilter[];



  /**
   * This is usually the dom id of the header ad slot.
   *
   * Some setups may have an ad slot only for the just premium skin.
   * This is the case if there are direct campaign formats for wallpapers
   * that require a DFP road block.
   */
  readonly skinAdSlotDomId: string;

  /**
   * dom ids of the ad slots that should not be requested when a just premium
   * skin appears in the bid responses.
   *
   * Depending on the wallpaperAdSlot these are usually skyscrapers left and right
   * and if there's a specific wallpaper ad slot the header as well.
   */
  readonly blockedAdSlotDomIds: string[];

  /**
   * if true, the ad slot will be set to display none
   */
  readonly hideSkinAdSlot: boolean;
}

export default class Skin implements IModule {

  public readonly name: string = 'Skin';
  public readonly description: string = 'Block other ad slots if a wallpaper has won the auction';
  public readonly moduleType: ModuleType = 'prebid';

  constructor(private readonly skinModuleConfig: ISkinModuleConfig, private readonly window: Window) {
  }

  config(): Object | null {
    return this.skinModuleConfig;
  }

  checkConfig = (config: ISkinConfig, bidResponses: prebidjs.IBidResponsesMap): boolean => {
    const skinBidResponse = bidResponses[config.skinAdSlotDomId];

    const skinBids = skinBidResponse ? skinBidResponse.bids.filter(bid => {
      // go through all filters and check if one matches
      const oneFilterApplied = config.formatFilter.some(filter => {
        switch (filter.bidder) {
          case 'justpremium':
            return bid.bidder === prebidjs.JustPremium && bid.format === filter.format;
          case 'dspx':
            return bid.bidder === prebidjs.DSPX;
          default: return false;
        }
      });
      // check cpm to make sure this is a valid bid
      return bid.cpm > 0 && oneFilterApplied;
    }) : [];

    return skinBids.length !== 0;
  };

  /**
   *
   * @param bidResponses
   * @return the first skin config with matching filters. If no config matches, undefined is being returned
   */
  selectConfig = (bidResponses: prebidjs.IBidResponsesMap): ISkinConfig | undefined => {
    return this.skinModuleConfig.configs.find(config => this.checkConfig(config, bidResponses));
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

    const domIds = this.skinModuleConfig.configs.reduce<string[]>((domIds, config) => {
      return [...domIds, config.skinAdSlotDomId, ...config.blockedAdSlotDomIds];
    }, [])
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

        const skinConfig = this.selectConfig(bidResponses);

        if (skinConfig) {
          log.debug('SkinModule', 'Skin configuration applied', skinConfig);
          skinConfig.blockedAdSlotDomIds.forEach(this.destroyAdSlot(slotDefinitions));

          try {
            const wallpaperDiv = document.getElementById(skinConfig.skinAdSlotDomId);
            if (skinConfig.hideSkinAdSlot && wallpaperDiv) {
              wallpaperDiv.style.setProperty('display', 'none');
            }
          } catch (e) {
            log.error('SkinModule', `Couldn't set the the wallpaper div ${skinConfig.skinAdSlotDomId} to display:none;`, e);
          }
        }
      }
    };

  }

}
