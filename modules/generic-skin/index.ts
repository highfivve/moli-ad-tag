import { googletag } from '@highfivve/ad-tag/source/ts/types/googletag';
import { IModule, ModuleType } from '@highfivve/ad-tag/source/ts/types/module';
import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { prebidjs } from '@highfivve/ad-tag/source/ts/types/prebidjs';
import { getLogger } from '@highfivve/ad-tag/source/ts/util/logging';
import { IAssetLoaderService } from '@highfivve/ad-tag/source/ts/util/assetLoaderService';
import { flatten, isNotNull } from '@highfivve/ad-tag/source/ts/util/arrayUtils';

interface ISkinModuleConfig {
  /**
   * A list of configurations. The first configuration with matching
   * format filters will be used.
   */
  readonly configs: ISkinConfig[];

  /**
   * Function to track when the skin cpm is lower than the combined cpm of the ad slots that
   * would be removed in its favour.
   */
  readonly trackSkinCpmLow?: (
    cpms: { skin: number; combinedNonSkinSlots: number },
    skinConfig: ISkinConfig,
    skinBid: prebidjs.IJustPremiumBidResponse | prebidjs.IGenericBidResponse
  ) => void;
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

  /**
   * if true, the blocked ad slots will be set to display: none
   */
  readonly hideBlockedSlots: boolean;

  /**
   * If the skin cpm comparison should be active, i.e. not only logging, but also preventing a skin render
   * if the other slots have a higher combined cpm.
   */
  readonly enableCpmComparison: boolean;
}

export enum SkinConfigEffect {
  BlockSkinSlot = 'BlockSkinSlot',
  BlockOtherSlots = 'BlockOtherSlots',
  NoBlocking = 'NoBlocking'
}

export default class Skin implements IModule {
  public readonly name: string = 'Skin';
  public readonly description: string = 'Block other ad slots if a wallpaper has won the auction';
  public readonly moduleType: ModuleType = 'prebid';

  private log?: Moli.MoliLogger;

  constructor(
    private readonly skinModuleConfig: ISkinModuleConfig,
    private readonly window: Window
  ) {}

  config(): Object | null {
    return this.skinModuleConfig;
  }

  /**
   * Check this skin config against the given bid responses to see if there are any skin bids inside, and if so (and
   * if the respective check is enabled), compare the highest-bidding skin cpm to the combined cpm of the other bids
   * to see if we'd be missing out on revenue if we applied the skin to the page.
   */
  getConfigEffect = (
    config: ISkinConfig,
    bidResponses: prebidjs.IBidResponsesMap
  ): SkinConfigEffect => {
    const { trackSkinCpmLow } = this.skinModuleConfig;
    const skinBidResponse = bidResponses[config.skinAdSlotDomId];
    const isSkinBid = (bid: prebidjs.BidResponse) => {
      // go through all filters and check if one matches
      const oneFilterApplied = config.formatFilter.some(filter => {
        switch (filter.bidder) {
          case 'justpremium':
            return bid.bidder === prebidjs.JustPremium && bid.format === filter.format;
          case 'dspx':
            return bid.bidder === prebidjs.DSPX;
          default:
            return false;
        }
      });
      // check cpm to make sure this is a valid bid
      return bid.cpm > 0 && oneFilterApplied;
    };

    // get all slot dom ids
    const adSlotIds = Object.keys(bidResponses);
    const nonSkinBids = flatten(
      adSlotIds
        // collect all bid responses for these ad slot dom ids
        .map(domId => ({ adSlotId: domId, ...bidResponses[domId] }))
        // filter out all dom ids that aren't affected by this skin
        .filter(
          bidObject =>
            [...config.blockedAdSlotDomIds, config.skinAdSlotDomId].indexOf(bidObject.adSlotId) > -1
        )
        .filter(bidObject => isNotNull(bidObject.bids))
        .map(bidObject =>
          bidObject.bids
            // filter out skin bid to not include it in the non-skin cpm sum
            .filter(bid => !isSkinBid(bid))
            // highest cpm bid goes first
            .sort((bid1, bid2) => bid2.cpm - bid1.cpm)
            // take(1)
            .slice(0, 1)
        )
    );

    const combinedNonSkinCpm = nonSkinBids.reduce((prev, current) => prev + current.cpm, 0);
    const skinBids = skinBidResponse
      ? // sort the skin bids to ensure we compare the highest bidding skin to the other slots' cpms
        skinBidResponse.bids.filter(isSkinBid).sort((bid1, bid2) => bid2.cpm - bid1.cpm)
      : [];

    const skinConfigEffect: SkinConfigEffect =
      skinBids.length > 0
        ? skinBids[0].cpm > combinedNonSkinCpm
          ? // skin cpm is higher than the other cpms combined: block bids for the other slots.
            SkinConfigEffect.BlockOtherSlots
          : // skin cpm is less than or equal to the other cpms: the skin will be blocked.
            SkinConfigEffect.BlockSkinSlot
        : // no skin config - that means no action should be taken.
          SkinConfigEffect.NoBlocking;

    if (this.log) {
      this.log.debug(this.name, 'nonSkinBids', nonSkinBids);
      this.log.debug(this.name, 'skinBids', skinBids);
    }

    if (trackSkinCpmLow && skinConfigEffect === SkinConfigEffect.BlockSkinSlot) {
      trackSkinCpmLow(
        { skin: skinBids[0].cpm, combinedNonSkinSlots: combinedNonSkinCpm },
        config,
        skinBids[0]
      );
      if (this.log) {
        this.log.debug(this.name, 'trackSkinCpmLow', nonSkinBids);
      }
    }

    if (config.enableCpmComparison) {
      return skinConfigEffect;
    }

    return skinBids.length > 0 ? SkinConfigEffect.BlockOtherSlots : SkinConfigEffect.NoBlocking;
  };

  /**
   *
   * @param bidResponses
   * @return the first skin config with matching filters. If no config matches, undefined is being returned
   */
  selectConfig = (
    bidResponses: prebidjs.IBidResponsesMap
  ): { skinConfig: ISkinConfig; configEffect: SkinConfigEffect } | undefined =>
    this.skinModuleConfig.configs
      .map(config => ({
        skinConfig: config,
        configEffect: this.getConfigEffect(config, bidResponses)
      }))
      .find(({ configEffect }) => configEffect !== SkinConfigEffect.NoBlocking);

  /**
   * Destroy the slot defined by the given DOM ID.
   *
   * NOTE: Accesses the global gpt.js tag (window.googletag).
   *
   * @param slotDefinitions all available slots
   * @return function that destroys a given adSlot by domId
   */
  destroyAdSlot = (slotDefinitions: Moli.SlotDefinition[]) => (adSlotDomId: string): void => {
    const adSlots = slotDefinitions
      .map(slot => slot.adSlot)
      .filter((slot: googletag.IAdSlot) => slot.getSlotElementId() === adSlotDomId);
    (this.window as Window & googletag.IGoogleTagWindow).googletag.destroySlots(adSlots);
  };

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    const log = getLogger(config, this.window);
    this.log = log;
    if (!config.prebid) {
      log.error('SkinModule', "Prebid isn't configured!");
      return;
    }

    const domIds = this.skinModuleConfig.configs
      .reduce<string[]>((domIds, config) => {
        return [...domIds, config.skinAdSlotDomId, ...config.blockedAdSlotDomIds];
      }, [])
      .filter(domId => !config.slots.some(slot => slot.domId === domId));

    if (domIds.length > 0) {
      log.error('SkinModule', "Couldn't find one or more ids in the ad slot config:", domIds);
      return;
    }

    const prebidListener = config.prebid.listener;
    if (prebidListener) {
      log.error('SkinModule', "Couldn't define prebidListener, because there was already set one.");
      return;
    }

    config.prebid.listener = {
      preSetTargetingForGPTAsync: (bidResponses, timedOut, slotDefinitions) => {
        const skinConfigWithEffect = this.selectConfig(bidResponses);

        if (skinConfigWithEffect) {
          const { skinConfig, configEffect } = skinConfigWithEffect;

          if (configEffect === SkinConfigEffect.BlockOtherSlots) {
            log.debug('SkinModule', 'Skin configuration applied', skinConfig);
            skinConfig.blockedAdSlotDomIds.forEach(this.destroyAdSlot(slotDefinitions));

            if (skinConfig.hideBlockedSlots) {
              skinConfig.blockedAdSlotDomIds.forEach(this.hideAdSlot(log));
            }

            if (skinConfig.hideSkinAdSlot) {
              this.hideAdSlot(log)(skinConfig.skinAdSlotDomId);
            }
          } else if (skinConfig.enableCpmComparison) {
            log.debug('SkinModule', 'Skin configuration ignored because cpm was low', skinConfig);

            this.destroyAdSlot(slotDefinitions)(skinConfig.skinAdSlotDomId);
          }
        }
      }
    };
  }

  private hideAdSlot = (log: Moli.MoliLogger) => (domId: string): void => {
    const element = this.window.document.getElementById(domId);
    try {
      if (element) {
        log.debug('SkinModule', `Set display:none for ${domId}`);
        element.style.setProperty('display', 'none');
      }
    } catch (e) {
      log.error('SkinModule', `Couldn't set the the wallpaper div ${domId} to display:none;`, e);
    }
  };
}
