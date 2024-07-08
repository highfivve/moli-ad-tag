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
import { prebidjs } from 'ad-tag/types/prebidjs';
import { IModule, ModuleType } from 'ad-tag/types/module';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkInitStep,
  PrepareRequestAdsStep
} from '../../adPipeline';
import { flatten, isNotNull, uniquePrimitiveFilter } from 'ad-tag/util/arrayUtils';
import { googletag } from 'ad-tag/types/googletag';
import { behaviour, modules } from 'ad-tag/types/moliConfig';

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

  private skinModuleConfig: modules.skin.SkinModuleConfig | null = null;

  private log?: MoliRuntime.MoliLogger;

  private currentSkinAdReloadSetTimeoutId: number | null = null;

  config(): Object | null {
    return this.skinModuleConfig;
  }

  configure(moduleConfig?: modules.ModulesConfig) {
    if (moduleConfig?.skin && moduleConfig.skin.enabled) {
      this.skinModuleConfig = moduleConfig.skin;
    }
  }

  initSteps(): InitStep[] {
    const config = this.skinModuleConfig;
    return config
      ? [
          mkInitStep('skin-init', ctx => {
            if (ctx.env === 'test') {
              return Promise.resolve();
            }
            ctx.window.pbjs.que.push(() => {
              ctx.window.pbjs.onEvent('auctionEnd', auctionObject => {
                this.runSkinConfigs(config, auctionObject, ctx);
              });
            });
            return Promise.resolve();
          })
        ]
      : [];
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
    logger: MoliRuntime.MoliLogger,
    trackSkinCpmLow: modules.skin.SkinModuleConfig['trackSkinCpmLow']
  ): SkinConfigEffect => {
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
        .filter(domId => config.blockedAdSlotDomIds.indexOf(domId) > -1)
        // collect all bid responses for these ad slot dom ids
        .map(domId => ({
          adSlotId: domId,
          bids: auctionObject.bidsReceived?.filter(bid => bid.adUnitCode === domId)
        }))
        .filter(bidObject => isNotNull(bidObject.bids))
        .map(bidObject =>
          bidObject
            .bids! // filter out skin bid to not include it in the non-skin cpm sum
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
   * @param moduleConfig
   * @param auctionObject
   * @param logger
   * @return the first skin config with matching filters. If no config matches, undefined is being returned
   */
  selectConfig = (
    moduleConfig: modules.skin.SkinModuleConfig,
    auctionObject: prebidjs.event.AuctionObject,
    logger: MoliRuntime.MoliLogger
  ): { skinConfig: modules.skin.SkinConfig; configEffect: SkinConfigEffect } | undefined =>
    moduleConfig.configs
      .map(config => ({
        skinConfig: config,
        configEffect: this.getConfigEffect(
          config,
          auctionObject,
          logger,
          moduleConfig.trackSkinCpmLow
        )
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

  private runSkinConfigs = (
    config: modules.skin.SkinModuleConfig,
    auctionObject: prebidjs.event.AuctionObject,
    ctx: AdPipelineContext
  ) => {
    const skinConfigWithEffect = this.selectConfig(config, auctionObject, ctx.logger);

    const getGoogleAdSlotByDomId = (domId: string): googletag.IAdSlot | undefined => {
      const slots = ctx.window.googletag.pubads().getSlots();
      return slots.find(slot => slot.getSlotElementId() === domId);
    };

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
        const highestSkinBid = auctionObject.bidsReceived
          ?.filter(bid => bid.adUnitCode === skinConfig.skinAdSlotDomId)
          .sort((bid1, bid2) => bid2.cpm - bid1.cpm)[0];

        // ad reload only for dspx wallpaper at the moment --> if dspx is about to win, we reload the wallpaper
        // the cleanup-module takes care of deleting the previous wallpaper
        if (
          skinConfig.adReload?.intervalMs &&
          highestSkinBid?.bidder &&
          skinConfig.adReload.allowed.includes(highestSkinBid.bidder)
        ) {
          const loadingBehaviorOfSlotsToRefresh = ctx.config.slots
            .filter(
              slots =>
                slots.domId === skinConfig.skinAdSlotDomId ||
                skinConfig.blockedAdSlotDomIds.includes(slots.domId)
            )
            .map(slot => slot.behaviour.loaded);

          const allSlotsHaveSameLoadingBehavior = loadingBehaviorOfSlotsToRefresh.every(
            loadingBehavior => loadingBehavior === loadingBehaviorOfSlotsToRefresh[0]
          );

          // only reload if blocked slots and skin slot all have the same loading behavior
          if (
            allSlotsHaveSameLoadingBehavior &&
            loadingBehaviorOfSlotsToRefresh[0] !== 'infinite'
          ) {
            if (this.currentSkinAdReloadSetTimeoutId) {
              clearTimeout(this.currentSkinAdReloadSetTimeoutId);
            }

            this.currentSkinAdReloadSetTimeoutId = ctx.window.setTimeout(() => {
              ctx.window.moli.refreshAdSlot(
                [...skinConfig.blockedAdSlotDomIds, skinConfig.skinAdSlotDomId],
                {
                  loaded: loadingBehaviorOfSlotsToRefresh[0] as Exclude<
                    behaviour.ISlotLoading['loaded'],
                    'infinite'
                  >
                }
              );
              // Set the native-reload targeting of the skin slot to true in order to track ad reload
              // the key is configurable in the ad reload and should be tied to this setting in the future
              getGoogleAdSlotByDomId(skinConfig.skinAdSlotDomId)?.setTargeting(
                'native-reload',
                'true'
              );

              ctx.logger.info(
                'SkinModule',
                'Ad reload for skin and blocked slots triggered',
                skinConfig.skinAdSlotDomId,
                skinConfig.blockedAdSlotDomIds
              );
            }, skinConfig.adReload?.intervalMs);
          } else {
            ctx.logger.error(
              'SkinModule',
              'Ad reload not possible because of different loading behaviors of the slots that should be refreshed:',
              loadingBehaviorOfSlotsToRefresh
            );
          }
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
      const unusedSlots = config.configs
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
