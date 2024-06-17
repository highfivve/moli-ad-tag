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
 *     // configuration for regular wallpaper/skin from GumGum or Screen on Demand (DSPX)
 *     {
 *       formatFilter: [
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
 *     // configuration for regular wallpaper/skin from GumGum or Screen on Demand (DSPX)
 *     {
 *       formatFilter: [
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
  isNotNull,
  uniquePrimitiveFilter
} from '@highfivve/ad-tag';
import MoliWindow = Moli.MoliWindow;
import BidderCode = prebidjs.BidderCode;
import ISlotLoading = Moli.behaviour.ISlotLoading;

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
    skinBid: prebidjs.IBidResponse
  ) => void;
};

/**
 * If this filter is added to the list of filters, then it will always apply.
 * This filter is useful for "orchestration ad units" that don't serve ads, but
 * orchestrate a format. Examples are
 *
 * - `wallpaper_pixel`
 */
export type AllFormatFilter = {
  readonly bidder: '*';
};

export type GumGumFormatFilter = {
  readonly bidder: typeof prebidjs.GumGum;

  /**
   * Stands for _ad id_ and contains the format delivered.
   *
   * - `59` = in-screen cascade (former mobile skin)
   * - `39` = in-screen expandable (mobile expandable)
   *
   * If not set, then the `auid` will not be considered for filtering.
   */
  readonly auid?: number;
};

/**
 * Azerion (fka Improve Digital) format filter
 */
export type AzerionFormatFilter = {
  readonly bidder: typeof prebidjs.ImproveDigital;
};

export type DSPXFormatFilter = {
  readonly bidder: typeof prebidjs.DSPX;
};

export type VisxFormatFilter = {
  readonly bidder: typeof prebidjs.Visx;
};

/**
 * Partners buying skin demand via the Xandr platform
 */
export type XandrFormatFilter = {
  readonly bidder: typeof prebidjs.AppNexusAst | typeof prebidjs.AppNexus;
};

/**
 * Partners buying skin demand via the Yieldlab platform
 */
export type YieldlabFormatFilter = {
  readonly bidder: typeof prebidjs.Yieldlab;
};

export type FormatFilter =
  | AllFormatFilter
  | AzerionFormatFilter
  | GumGumFormatFilter
  | DSPXFormatFilter
  | VisxFormatFilter
  | YieldlabFormatFilter
  | XandrFormatFilter;

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
   * Selector for an (additional) ad slot container that should be set to display: none
   *
   * e.g. mobile-sticky ads have another container wrapped around the ad slot container itself which can be hidden like this:
   * hideBlockedSlotsSelector: '[data-ref="sticky-ad"]'
   */

  hideBlockedSlotsSelector?: string;

  /**
   * If set to true the ad slot that would load the skin is being destroyed.
   * This is useful only for ad slots that serve as a special "skin ad slot"
   * and have otherwise no other function.
   *
   * @default false
   */
  readonly destroySkinSlot?: boolean;

  /**
   * If set, the skin of the configured bidder reloads after the given interval (in ms).
   */
  readonly adReload?: { intervalMs: number; allowed: BidderCode[] };
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
          case '*':
            return true;
          case 'appnexus':
          case 'appnexusAst':
            return bid.bidder === prebidjs.AppNexusAst || bid.bidder === prebidjs.AppNexus;
          case 'improvedigital':
            return bid.bidder === prebidjs.ImproveDigital;
          case 'gumgum':
            return (
              bid.bidder === prebidjs.GumGum &&
              // if auid is set, it must match the bid.ad.auid
              (filter.auid === undefined ||
                (typeof bid.ad !== 'string' && bid.ad.auid === filter.auid))
            );
          case 'dspx':
            return bid.bidder === prebidjs.DSPX;
          case 'visx':
            return bid.bidder === prebidjs.Visx;
          case 'yieldlab':
            return bid.bidder === prebidjs.Yieldlab;
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
        // filter out all dom ids that aren't the configured blocked ad slots (non-skin ad slots)
        .filter(bidObject => config.blockedAdSlotDomIds.indexOf(bidObject.adSlotId) > -1)
        .filter(bidObject => isNotNull(bidObject.bids))
        .map(bidObject =>
          bidObject
            .bids! // highest cpm bid goes first
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

            if (skinConfig.hideBlockedSlotsSelector) {
              this.window.document
                .querySelectorAll<HTMLElement>(skinConfig.hideBlockedSlotsSelector)
                .forEach(node => {
                  log.debug(
                    'SkinModule',
                    `Set display:none for container with selector ${skinConfig.hideBlockedSlotsSelector}`
                  );
                  node.style.setProperty('display', 'none');
                });
            }

            const highestSkinBid = bidResponses[skinConfig.skinAdSlotDomId]?.bids.sort(
              (bid1, bid2) => bid2.cpm - bid1.cpm
            )[0];
            let timeoutId: number | null = null;
            const getGoogleAdSlotByDomId = (domId: string): googletag.IAdSlot | undefined => {
              const slots = (this.window as Window & googletag.IGoogleTagWindow).googletag
                .pubads()
                .getSlots();
              return slots.find(slot => slot.getSlotElementId() === domId);
            };

            // ad reload only for dspx wallpaper at the moment --> if dspx is about to win, we reload the wallpaper
            // the cleanup-module takes care of deleting the previous wallpaper
            if (
              skinConfig.adReload?.intervalMs &&
              highestSkinBid?.bidder &&
              skinConfig.adReload.allowed.includes(highestSkinBid.bidder)
            ) {
              const loadingBehaviorOfSlotsToRefresh = slotDefinitions
                .filter(
                  definition =>
                    definition.moliSlot.domId === skinConfig.skinAdSlotDomId ||
                    skinConfig.blockedAdSlotDomIds.includes(definition.moliSlot.domId)
                )
                .map(slot => slot.moliSlot.behaviour.loaded);

              const allSlotsHaveSameLoadingBehavior = loadingBehaviorOfSlotsToRefresh.every(
                loadingBehavior => loadingBehavior === loadingBehaviorOfSlotsToRefresh[0]
              );

              // only reload if blocked slots and skin slot all have the same loading behavior
              if (
                allSlotsHaveSameLoadingBehavior &&
                loadingBehaviorOfSlotsToRefresh[0] !== 'infinite'
              ) {
                // Clear the last skin timeout if it exists (e.g. after navigation in a SPA)
                if (timeoutId) {
                  clearTimeout(timeoutId);
                }

                timeoutId = this.window.setTimeout(() => {
                  (this.window as Window & MoliWindow).moli.refreshAdSlot(
                    [...skinConfig.blockedAdSlotDomIds, skinConfig.skinAdSlotDomId],
                    {
                      loaded: loadingBehaviorOfSlotsToRefresh[0] as Exclude<
                        ISlotLoading['loaded'],
                        'infinite'
                      >
                    }
                  );

                  // Set the native-reload targeting of the skin slot to true in order to track ad reload
                  getGoogleAdSlotByDomId(skinConfig.skinAdSlotDomId)?.setTargeting(
                    'native-reload',
                    'true'
                  );

                  log.info(
                    'SkinModule',
                    'Ad reload for skin and blocked slots triggered',
                    skinConfig.skinAdSlotDomId,
                    skinConfig.blockedAdSlotDomIds
                  );
                }, skinConfig.adReload?.intervalMs);
              } else {
                log.error(
                  'SkinModule',
                  'Ad reload not possible because of different loading behaviors of the slots that should be refreshed:',
                  loadingBehaviorOfSlotsToRefresh
                );
              }
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
            .map(skinConfig => skinConfig.skinAdSlotDomId)
            .filter(uniquePrimitiveFilter)
            .forEach(this.destroyAdSlot(slotDefinitions));
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
