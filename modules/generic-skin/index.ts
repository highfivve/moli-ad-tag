/**
 * # Generic Skin / Wallpaper Module
 *
 * This module allows us to configure `prebidResponse` listener that when a just premium or dspx wallpaper has won the auction
 *
 * - removes certain other ad units
 * - hides the ad slot div where the skin was requested
 *
 * ## Integration
 *
 * In your `index.ts` import the generic-skin module and register it.
 *
 *
 * ```javascript
 * import { Skin } from '@highfivve/module-generic-skin'
 *
 * moli.registerModule(new Skin({
 *   configs: [
 *     // configuration for regular wallpaper/skin from JustPremium or Screen on Demand (DSPX)
 *     {
 *       formatFilter: [
 *         { bidder: 'justpremium', format: 'wp' },
 *         { bidder: 'dspx' },
 *         { bidder: 'visx' }
 *       ],
 *       skinAdSlotDomId: 'my_header',
 *       hideSkinAdSlot: false,
 *       hideBlockedSlots: true,
 *       blockedAdSlotDomIds: [
 *         'my_sidebar_1',
 *         'my_sidebar_2',
 *         'my_sidebar_left',
 *         'my_floorad'
 *       ]
 *     }
 *   ]
 * }, window));
 * ```
 *
 * ### Skin optimization
 *
 * This module is capable of blocking the skin ad if the summed up CPM of all
 * blocked ad slots is higher than the skin CPM.
 *
 * This requires a separate ad unit for the skin.
 *
 * ```javascript
 * import { Skin } from '@highfivve/module-generic-skin'
 *
 * moli.registerModule(new Skin({
 *   configs: [
 *     // configuration for regular wallpaper/skin from JustPremium or Screen on Demand (DSPX)
 *     {
 *       formatFilter: [
 *         { bidder: 'justpremium', format: 'wp' },
 *         { bidder: 'dspx' },
 *       ],
 *       skinAdSlotDomId: 'my_skin',
 *       hideSkinAdSlot: false,
 *       hideBlockedSlots: true,
 *       blockedAdSlotDomIds: [
 *         'my_header',
 *         'my_sidebar_1',
 *         'my_sidebar_2',
 *         'my_sidebar_left',
 *         'my_floorad'
 *       ],
 *       enableCpmComparison: true // set this to true to prevent skin from rendering if its cpm is too low
 *     }
 *   ]
 * }, window));
 * ```
 *
 * @module
 */
import {
  googletag,
  IModule,
  ModuleType,
  Moli,
  prebidjs,
  getLogger,
  IAssetLoaderService,
  flatten,
  isNotNull
} from '@highfivve/ad-tag';

export type SkinModuleConfig = {
  /**
   * A list of configurations. The first configuration with matching
   * format filters will be used.
   */
  readonly configs: SkinConfig[];

  /**
   * Function to track when the skin cpm is lower than the combined cpm of the ad slots that
   * would be removed in its favour.
   */
  readonly trackSkinCpmLow?: (
    cpms: { skin: number; combinedNonSkinSlots: number },
    skinConfig: SkinConfig,
    skinBid: prebidjs.IJustPremiumBidResponse | prebidjs.IGenericBidResponse
  ) => void;
};

export type JustPremiumFormatFilter = {
  readonly bidder: typeof prebidjs.JustPremium;

  readonly format: prebidjs.JustPremiumFormat;
};

export type DSPXFormatFilter = {
  readonly bidder: typeof prebidjs.DSPX;
};

export type VisxFormatFilter = {
  readonly bidder: typeof prebidjs.Visx;
};

export type FormatFilter = JustPremiumFormatFilter | DSPXFormatFilter | VisxFormatFilter;

export type SkinConfig = {
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

  /**
   * If set to true the ad slot that would load the skin is being destroyed.
   * This is useful only for ad slots that serve as a special "skin ad slot"
   * and have otherwise no other function.
   *
   * @default false
   */
  readonly destroySkinSlot?: boolean;
};

export enum SkinConfigEffect {
  BlockSkinSlot = 'BlockSkinSlot',
  BlockOtherSlots = 'BlockOtherSlots',
  NoBlocking = 'NoBlocking'
}

/**
 * # Skin Module
 */
export class Skin implements IModule {
  public readonly name: string = 'skin';
  public readonly description: string = 'Block other ad slots if a wallpaper has won the auction';
  public readonly moduleType: ModuleType = 'prebid';

  private log?: Moli.MoliLogger;

  constructor(
    private readonly skinModuleConfig: SkinModuleConfig,
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
    config: SkinConfig,
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
          case 'visx':
            return bid.bidder === prebidjs.Visx;
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
          bidObject
            .bids! // filter out skin bid to not include it in the non-skin cpm sum
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
  ): { skinConfig: SkinConfig; configEffect: SkinConfigEffect } | undefined =>
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
  destroyAdSlot =
    (slotDefinitions: Moli.SlotDefinition[]) =>
    (adSlotDomId: string): void => {
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
        } else {
          // there's no matching configuration so we check if there are any
          // slots that should not be part of the ad request to save bandwidth,
          // money and improve reporting
          this.skinModuleConfig.configs
            .filter(skinConfig => skinConfig.destroySkinSlot)
            .forEach(skinConfig => this.destroyAdSlot(slotDefinitions)(skinConfig.skinAdSlotDomId));
        }
      }
    };
  }

  private hideAdSlot =
    (log: Moli.MoliLogger) =>
    (domId: string): void => {
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
