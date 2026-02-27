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
 * import { createSkin } from '@highfivve/module-generic-skin'
 *
 * moli.registerModule(createSkin());
 * ```
 *
 * @module
 */
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { IModule, ModuleType } from 'ad-tag/types/module';
import { googletag } from 'ad-tag/types/googletag';
import { modules } from 'ad-tag/types/moliConfig';
import { flatten, isNotNull, uniquePrimitiveFilter } from 'ad-tag/util/arrayUtils';

export const enum SkinConfigEffect {
  BlockSkinSlot = 'BlockSkinSlot',
  BlockOtherSlots = 'BlockOtherSlots',
  NoBlocking = 'NoBlocking'
}

export const filterHighestNonSkinBid = (
  bidResponses: prebidjs.IBidResponsesMap,
  blockedAdSlotDomIds: string[]
): prebidjs.BidResponse[] => {
  const adSlotIds = Object.keys(bidResponses);
  return flatten(
    adSlotIds
      // collect all bid responses for these ad slot dom ids
      .map(domId => ({ adSlotId: domId, ...bidResponses[domId] }))
      // filter out all dom ids that aren't the configured blocked ad slots (non-skin ad slots)
      .filter(bidObject => blockedAdSlotDomIds.indexOf(bidObject.adSlotId) > -1)
      .filter(bidObject => isNotNull(bidObject.bids))
      .map(bidObject =>
        bidObject
          .bids! // highest cpm bid goes first
          .sort((bid1, bid2) => bid2.cpm - bid1.cpm)
          // take(1)
          .slice(0, 1)
      )
  );
};

export interface ISkinModule extends IModule {
  prebidBidsBackHandler__(): MoliRuntime.PrebidBidsBackHandler[];
  getConfigEffect(
    config: modules.skin.SkinConfig,
    bidResponses: prebidjs.IBidResponsesMap,
    log: MoliRuntime.MoliLogger
  ): SkinConfigEffect;
  selectConfig(
    skinModuleConfig: modules.skin.SkinModuleConfig,
    bidResponses: prebidjs.IBidResponsesMap,
    log: MoliRuntime.MoliLogger
  ): { skinConfig: modules.skin.SkinConfig; configEffect: SkinConfigEffect } | undefined;
  destroyAdSlot(
    slotDefinitions: MoliRuntime.SlotDefinition[],
    gWindow: googletag.IGoogleTagWindow
  ): (adSlotDomId: string) => void;
  runSkinConfigs(
    skinModuleConfig: modules.skin.SkinModuleConfig
  ): (
    ctx: AdPipelineContext,
    bidResponses: prebidjs.IBidResponsesMap,
    slotDefinitions: MoliRuntime.SlotDefinition[]
  ) => void;
}

/**
 * # Skin Module
 */
export const createSkin = (): ISkinModule => {
  const name = 'skin';
  let skinModuleConfig: modules.skin.SkinModuleConfig | null = null;
  let bidsBackHandler: MoliRuntime.PrebidBidsBackHandler[] = [];

  const config__ = (): Object | null => skinModuleConfig;

  /**
   * Check this skin config against the given bid responses to see if there are any skin bids inside, and if so (and
   * if the respective check is enabled), compare the highest-bidding skin cpm to the combined cpm of the other bids
   * to see if we'd be missing out on revenue if we applied the skin to the page.
   */
  const getConfigEffect = (
    config: modules.skin.SkinConfig,
    bidResponses: prebidjs.IBidResponsesMap,
    log: MoliRuntime.MoliLogger
  ): SkinConfigEffect => {
    const skinBidResponse = bidResponses[config.skinAdSlotDomId];
    const isSkinBid = (bid: prebidjs.BidResponse) => {
      // go through all filters and check if one matches
      const oneFilterApplied = config.formatFilter.some(filter => {
        switch (filter.bidder) {
          case '*':
            return true;
          case 'gumgum':
            return (
              bid.bidder === prebidjs.GumGum &&
              // if auid is set, it must match the bid.ad.auid
              (filter.auid === undefined ||
                (typeof bid.ad !== 'string' && bid.ad.auid === filter.auid))
            );
          default:
            return bid.bidder === filter.bidder;
        }
      });
      // check cpm to make sure this is a valid bid
      return bid.cpm > 0 && oneFilterApplied;
    };

    // get all slot dom ids
    const nonSkinBids = filterHighestNonSkinBid(bidResponses, config.blockedAdSlotDomIds);

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

    log.debug(name, 'nonSkinBids', nonSkinBids);
    log.debug(name, 'skinBids', skinBids);

    if (config.enableCpmComparison) {
      return skinConfigEffect;
    }

    return skinBids.length > 0 ? SkinConfigEffect.BlockOtherSlots : SkinConfigEffect.NoBlocking;
  };

  /**
   *
   * @param skinModuleConfig
   * @param bidResponses
   * @param log
   * @return the first skin config with matching filters. If no config matches, undefined is being returned
   */
  const selectConfig = (
    skinModuleConfig: modules.skin.SkinModuleConfig,
    bidResponses: prebidjs.IBidResponsesMap,
    log: MoliRuntime.MoliLogger
  ): { skinConfig: modules.skin.SkinConfig; configEffect: SkinConfigEffect } | undefined =>
    skinModuleConfig.configs
      .map(config => ({
        skinConfig: config,
        configEffect: getConfigEffect(config, bidResponses, log)
      }))
      .find(({ configEffect }) => configEffect !== SkinConfigEffect.NoBlocking);

  /**
   * Destroy the slot defined by the given DOM ID.
   *
   * NOTE: Accesses the global gpt.js tag (window.googletag).
   *
   * @param slotDefinitions all available slots
   * @param gWindow
   * @return function that destroys a given adSlot by domId
   */
  const destroyAdSlot =
    (slotDefinitions: MoliRuntime.SlotDefinition[], gWindow: googletag.IGoogleTagWindow) =>
    (adSlotDomId: string): void => {
      const adSlots = slotDefinitions
        .map(slot => slot.adSlot)
        .filter((slot: googletag.IAdSlot) => slot.getSlotElementId() === adSlotDomId);
      gWindow.googletag.destroySlots(adSlots);
    };

  const hideAdSlot =
    (_window: Window, log: MoliRuntime.MoliLogger) =>
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

  const runSkinConfigs =
    (skinModuleConfig: modules.skin.SkinModuleConfig) =>
    (
      ctx: AdPipelineContext,
      bidResponses: prebidjs.IBidResponsesMap,
      slotDefinitions: MoliRuntime.SlotDefinition[]
    ): void => {
      const skinConfigWithEffect = selectConfig(skinModuleConfig, bidResponses, ctx.logger__);

      if (skinConfigWithEffect) {
        const { skinConfig, configEffect } = skinConfigWithEffect;

        if (configEffect === SkinConfigEffect.BlockOtherSlots) {
          ctx.logger__.debug('SkinModule', 'Skin configuration applied', skinConfig);
          skinConfig.blockedAdSlotDomIds.forEach(destroyAdSlot(slotDefinitions, ctx.window__));

          if (skinConfig.hideBlockedSlots) {
            skinConfig.blockedAdSlotDomIds.forEach(hideAdSlot(ctx.window__, ctx.logger__));
          }

          if (skinConfig.hideSkinAdSlot) {
            hideAdSlot(ctx.window__, ctx.logger__)(skinConfig.skinAdSlotDomId);
          }

          if (skinConfig.hideBlockedSlotsSelector) {
            ctx.window__.document
              .querySelectorAll<HTMLElement>(skinConfig.hideBlockedSlotsSelector)
              .forEach(node => {
                ctx.logger__.debug(
                  'SkinModule',
                  `Set display:none for container with selector ${skinConfig.hideBlockedSlotsSelector}`
                );
                node.style.setProperty('display', 'none');
              });
          }

          if (skinConfig.targeting) {
            try {
              ctx.window__.googletag
                .pubads()
                .setTargeting(skinConfig.targeting.key, skinConfig.targeting.value ?? '1');
            } catch (e) {
              ctx.logger__.error('SkinModule', e);
            }
          }
        } else if (skinConfig.enableCpmComparison) {
          ctx.logger__.debug(
            'SkinModule',
            'Skin configuration ignored because cpm was low',
            skinConfig
          );

          destroyAdSlot(slotDefinitions, ctx.window__)(skinConfig.skinAdSlotDomId);
        }
      } else {
        // there's no matching configuration so we check if there are any
        // slots that should not be part of the ad request to save bandwidth,
        // money and improve reporting
        skinModuleConfig.configs
          .filter(skinConfig => skinConfig.destroySkinSlot)
          .map(skinConfig => skinConfig.skinAdSlotDomId)
          .filter(uniquePrimitiveFilter)
          .forEach(destroyAdSlot(slotDefinitions, ctx.window__));
      }
    };

  const configure__ = (moduleConfig?: modules.ModulesConfig) => {
    if (moduleConfig?.skin && moduleConfig.skin.enabled) {
      skinModuleConfig = moduleConfig.skin;
      bidsBackHandler.push(runSkinConfigs(moduleConfig.skin));
    }
  };

  const initSteps__ = (): InitStep[] => [];

  const configureSteps__ = (): ConfigureStep[] => [];

  const prepareRequestAdsSteps__ = (): PrepareRequestAdsStep[] => [];

  const prebidBidsBackHandler__ = (): MoliRuntime.PrebidBidsBackHandler[] => bidsBackHandler;

  return {
    name,
    description: 'Block other ad slots if a wallpaper has won the auction',
    moduleType: 'prebid' as ModuleType,
    config__,
    configure__,
    initSteps__,
    configureSteps__,
    prepareRequestAdsSteps__,
    prebidBidsBackHandler__,
    getConfigEffect,
    selectConfig,
    destroyAdSlot,
    runSkinConfigs
  };
};
