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
import { prebidjs } from '../../../types/prebidjs';
import { IModule, ModuleType } from '../../../types/module';
import { MoliRuntime } from '../../../types/moliRuntime';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkInitStep,
  PrepareRequestAdsStep
} from '../../adPipeline';
import { flatten, isNotNull, uniquePrimitiveFilter } from '../../../util/arrayUtils';
import { googletag } from '../../../types/googletag';
import { modules } from '../../../types/moliConfig';

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

  private log?: MoliRuntime.MoliLogger;

  constructor(private readonly skinModuleConfig: modules.skin.SkinModuleConfig) {}

  config(): Object | undefined {
    return this.skinModuleConfig;
  }

  initSteps(): InitStep[] {
    return [
      mkInitStep('skin-init', ctx => {
        if (ctx.env === 'test') {
          return Promise.resolve();
        }
        ctx.window.pbjs.que.push(() => {
          ctx.window.pbjs.onEvent('auctionEnd', auctionObject => {
            this.runSkinConfigs(auctionObject, ctx);
          });
        });
        return Promise.resolve();
      })
    ];
  }

  configureSteps(): ConfigureStep[] {
    return [];
  }

  prepareRequestAdsSteps(): PrepareRequestAdsStep[] {
    return [];
  }

  /**
   * Check this skin config against the given bid responses to see if there are any skin bids inside, and if so (and
   * if the respective check is enabled), compare the highest-bidding skin cpm to the combined cpm of the other bids
   * to see if we'd be missing out on revenue if we applied the skin to the page.
   */
  getConfigEffect = (
    config: modules.skin.SkinConfig,
    auctionObject: prebidjs.event.AuctionObject,
    logger: MoliRuntime.MoliLogger
  ): SkinConfigEffect => {
    const { trackSkinCpmLow } = this.skinModuleConfig;
    // const skinBidResponse = auctionObject[config.skinAdSlotDomId];
    const skinBidResponses = auctionObject.bidsReceived?.filter(
      bid => bid.adUnitCode === config.skinAdSlotDomId
    );

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
    const adSlotIds = auctionObject.adUnitCodes || [];
    const nonSkinBids = flatten(
      adSlotIds
        // filter out all dom ids that aren't affected by this skin.
        // the skin must be included to allow for further checking later
        .filter(
          domId => [...config.blockedAdSlotDomIds, config.skinAdSlotDomId].indexOf(domId) > -1
        )
        // collect all bid responses for these ad slot dom ids
        .map(domId => ({
          adSlotId: domId,
          bids: auctionObject.bidsReceived?.filter(bid => bid.adUnitCode === domId)
        }))
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
    const skinBids = skinBidResponses
      ? // sort the skin bids to ensure we compare the highest bidding skin to the other slots' cpms
        skinBidResponses.filter(isSkinBid).sort((bid1, bid2) => bid2.cpm - bid1.cpm)
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

    logger.debug(this.name, 'nonSkinBids', nonSkinBids);
    logger.debug(this.name, 'skinBids', skinBids);

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
   * @param auctionObject
   * @param logger
   * @return the first skin config with matching filters. If no config matches, undefined is being returned
   */
  selectConfig = (
    auctionObject: prebidjs.event.AuctionObject,
    logger: MoliRuntime.MoliLogger
  ): { skinConfig: modules.skin.SkinConfig; configEffect: SkinConfigEffect } | undefined =>
    this.skinModuleConfig.configs
      .map(config => ({
        skinConfig: config,
        configEffect: this.getConfigEffect(config, auctionObject, logger)
      }))
      .find(({ configEffect }) => configEffect !== SkinConfigEffect.NoBlocking);

  /**
   * Destroy the slot defined by the given DOM ID.
   *
   * NOTE: Accesses the global gpt.js tag (window.googletag).
   *
   * @param slotDomIds a list of slots to destroy
   * @param _window required to access googletag
   */
  destroyAdSlots = (slotDomIds: string[], _window: googletag.IGoogleTagWindow) => {
    const adSlots = _window.googletag
      .pubads()
      .getSlots()
      .filter((slot: googletag.IAdSlot) => slotDomIds.includes(slot.getSlotElementId()));
    if (adSlots.length > 0) {
      _window.googletag.destroySlots(adSlots);
    }
  };

  init(): void {
    // noop
  }

  private runSkinConfigs = (
    auctionObject: prebidjs.event.AuctionObject,
    ctx: AdPipelineContext
  ) => {
    const skinConfigWithEffect = this.selectConfig(auctionObject, ctx.logger);

    if (skinConfigWithEffect) {
      const { skinConfig, configEffect } = skinConfigWithEffect;

      if (configEffect === SkinConfigEffect.BlockOtherSlots) {
        ctx.logger.debug('SkinModule', 'Skin configuration applied', skinConfig);
        this.destroyAdSlots(skinConfig.blockedAdSlotDomIds, ctx.window);

        if (skinConfig.hideBlockedSlots) {
          skinConfig.blockedAdSlotDomIds.forEach(this.hideAdSlot(ctx.logger, ctx.window));
        }

        if (skinConfig.hideSkinAdSlot) {
          this.hideAdSlot(ctx.logger, ctx.window)(skinConfig.skinAdSlotDomId);
        }

        if (skinConfig.hideBlockedSlotsSelector) {
          ctx.window.document
            .querySelectorAll<HTMLElement>(skinConfig.hideBlockedSlotsSelector)
            .forEach(node => {
              ctx.logger.debug(
                'SkinModule',
                `Set display:none for container with selector ${skinConfig.hideBlockedSlotsSelector}`
              );
              node.style.setProperty('display', 'none');
            });
        }
      } else if (skinConfig.enableCpmComparison) {
        ctx.logger.debug(
          'SkinModule',
          'Skin configuration ignored because cpm was low',
          skinConfig
        );

        this.destroyAdSlots([skinConfig.skinAdSlotDomId], ctx.window);
      }
    } else {
      // there's no matching configuration, so we check if there are any
      // slots that should not be part of the ad request to save bandwidth,
      // money and improve reporting
      const unusedSlots = this.skinModuleConfig.configs
        .filter(skinConfig => skinConfig.destroySkinSlot)
        .map(skinConfig => skinConfig.skinAdSlotDomId)
        .filter(uniquePrimitiveFilter)
        .filter(domId => auctionObject.adUnitCodes?.includes(domId) === false);

      this.destroyAdSlots(unusedSlots, ctx.window);
    }
  };

  private hideAdSlot =
    (log: MoliRuntime.MoliLogger, _window: Window) =>
    (domId: string): void => {
      const element = _window.document.getElementById(domId);
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
