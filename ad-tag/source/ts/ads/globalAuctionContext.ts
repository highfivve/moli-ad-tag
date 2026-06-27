import { prebidjs } from '../types/prebidjs';
import { googletag } from '../types/googletag';
import { createBiddersDisabling } from './auctions/biddersDisabling';
import { createAdRequestThrottling } from './auctions/adRequestThrottling';
import { auction, Overridable } from '../types/moliConfig';
import { createFrequencyCapping } from './auctions/frequencyCapping';
import { createPreviousBidCpms } from './auctions/previousBidCpms';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { EventService } from './eventService';
import { ConfigureStep, mkConfigureStep } from './adPipeline';
import { createInterstitialContext } from 'ad-tag/ads/auctions/interstitialContext';
import { createTrackWinningBidder } from 'ad-tag/ads/auctions/trackWinningBidder';
import { LabelCondition } from 'ad-tag/ads/labelConfigService';
import { resolveOverridableConfig } from 'ad-tag/ads/configOverrides';

/**
 * ## Global Auction Context
 *
 * This class wires up the external event systems to the internal state machines that provide additional features
 * around the auctions that happen on the device. This includes features like
 *
 * - Bidders Disabling
 * - Ad Request Throttling
 * - Frequency Capping
 *
 * ## Note for implementors
 *
 * This class does not contain any state itself, but only sets up event listeners and wires up the specific feature.
 * Every new feature must be enabled separately and should not share any data with other features.
 */
export interface GlobalAuctionContext {
  /**
   *
   * @param slot The GPT ad slot to check
   */
  isSlotThrottled(slot: googletag.IAdSlot): boolean;
  isBidderFrequencyCappedOnSlot(slotId: string, bidder: string): boolean;
  getLastBidCpmsOfAdUnit(slotId: string): number[];

  /**
   * Get the bidder code of the last winning bid for a given ad unit.
   * Returns undefined if no winning bid exists for this slot.
   *
   * @param slotId the DOM ID of the ad slot
   */
  getLastWinningBidderOfAdUnit(slotId: string): prebidjs.BidderCode | undefined;

  isBidderDisabled(domId: string, bidder: prebidjs.BidderCode): boolean;

  isBidderFrequencyCappedOnSlot(slotId: string, bidder: prebidjs.BidderCode): boolean;

  interstitialChannel(): auction.InterstitialChannel | null | undefined;

  /**
   * Check if the minimum number of ad requests/page impressions has been reached.
   * We treat requestAds() calls and page impressions as equivalent.
   * @param minRequestAds The minimum number of requestAds calls required
   * @returns true if the minimum number of ad requests has been reached, false otherwise.
   *          Always returns true if frequency capping is not enabled (since we can't track counts).
   */
  hasMinimumRequestAds(minRequestAds: number): boolean;

  configureStep(): ConfigureStep;
}

export const createGlobalAuctionContext = (
  window: Window &
    prebidjs.IPrebidjsWindow &
    googletag.IGoogleTagWindow &
    Pick<typeof globalThis, 'Date'>,
  logger: MoliRuntime.MoliLogger,
  eventService: EventService,
  config: auction.GlobalAuctionContextConfig = {},
  isLabelConditionMet: (condition: LabelCondition) => boolean = () => false
): GlobalAuctionContext => {
  // resolve label-conditioned config overrides for every first-level feature (first match wins,
  // full replace). runs once when the Global Auction Context is built; SPA navigations call
  // requestAds directly and never rebuild it, so the selected overrides are fixed for the page
  // lifetime. the resolver strips `overrides`, so the feature factories never see it.
  const resolveFeature = <C>(base: Overridable<C> | undefined, feature: string): C | undefined => {
    if (!base) {
      return undefined;
    }
    const {
      config: resolved,
      matchedOverrideIndex,
      matchedCondition
    } = resolveOverridableConfig(base, isLabelConditionMet);
    if (matchedOverrideIndex >= 0) {
      logger.debug(
        'GlobalAuctionContext',
        `feature ${feature}: applying config override #${matchedOverrideIndex}`,
        matchedCondition
      );
    }
    return resolved;
  };

  const trackWinningBidderConfig = resolveFeature(config.trackWinningBidder, 'trackWinningBidder');
  const biddersDisablingConfig = resolveFeature(config.biddersDisabling, 'biddersDisabling');
  const adRequestThrottlingConfig = resolveFeature(
    config.adRequestThrottling,
    'adRequestThrottling'
  );
  const frequencyCapConfig = resolveFeature(config.frequencyCap, 'frequencyCap');
  const previousBidCpmsConfig = resolveFeature(config.previousBidCpms, 'previousBidCpms');
  const interstitialConfig = resolveFeature(config.interstitial, 'interstitial');

  const trackWinningBidder = trackWinningBidderConfig?.enabled
    ? createTrackWinningBidder()
    : undefined;

  const biddersDisabling = biddersDisablingConfig?.enabled
    ? createBiddersDisabling(biddersDisablingConfig, window)
    : undefined;

  const adRequestThrottling = adRequestThrottlingConfig?.enabled
    ? createAdRequestThrottling(adRequestThrottlingConfig, window)
    : undefined;

  const frequencyCapping = frequencyCapConfig?.enabled
    ? createFrequencyCapping(frequencyCapConfig, window, window.Date.now, logger)
    : undefined;

  const previousBidCpms = previousBidCpmsConfig?.enabled ? createPreviousBidCpms() : undefined;

  const interstitial = interstitialConfig?.enabled
    ? createInterstitialContext(interstitialConfig, window, window.Date.now, logger)
    : undefined;

  // Ensure pbjs and googletag are initialized
  window.pbjs = window.pbjs || ({ que: [] } as unknown as prebidjs.IPrebidJs);
  window.googletag = window.googletag || ({} as unknown as googletag.IGoogleTag);
  window.googletag.cmd = window.googletag.cmd || [];

  // Register events
  if (
    biddersDisablingConfig?.enabled ||
    previousBidCpmsConfig?.enabled ||
    frequencyCapConfig?.enabled ||
    interstitialConfig?.enabled
  ) {
    window.pbjs.que.push(() => {
      window.pbjs.onEvent('auctionEnd', auction => {
        biddersDisabling?.onAuctionEnd(auction);
        interstitial?.onAuctionEnd(auction);
        if (previousBidCpmsConfig?.enabled && auction.bidsReceived) {
          previousBidCpms?.onAuctionEnd(auction.bidsReceived);
        }
        frequencyCapping?.onAuctionEnd(auction);
      });
    });
  }

  if (adRequestThrottlingConfig?.enabled || frequencyCapConfig?.enabled) {
    window.googletag.cmd.push(() => {
      window.googletag.pubads().addEventListener('slotRequested', event => {
        adRequestThrottling?.onSlotRequested(event);
        frequencyCapping?.onSlotRequested(event);
      });
    });
  }

  if (frequencyCapConfig?.enabled || trackWinningBidderConfig?.enabled) {
    window.pbjs.que.push(() => {
      window.pbjs.onEvent('bidWon', bid => {
        if (frequencyCapConfig) {
          frequencyCapping?.onBidWon(bid);
        }
        if (trackWinningBidderConfig) {
          trackWinningBidder?.onBidWon(bid);
        }
      });
    });
  }

  if (frequencyCapConfig?.enabled) {
    eventService.addEventListener('beforeRequestAds', () => {
      frequencyCapping?.beforeRequestAds();
    });
    eventService.addEventListener('afterRequestAds', () => {
      frequencyCapping?.afterRequestAds();
    });
  }

  if (frequencyCapConfig?.enabled || interstitialConfig?.enabled) {
    window.googletag.cmd.push(() => {
      window.googletag.pubads().addEventListener('slotRenderEnded', event => {
        frequencyCapping?.onSlotRenderEnded(event);
        interstitial?.onSlotRenderEnded(event);
      });
      window.googletag.pubads().addEventListener('impressionViewable', event => {
        frequencyCapping?.onImpressionViewable(event);
      });
    });
  }

  const configureStep = mkConfigureStep('GlobalAuctionContext', context => {
    frequencyCapping?.updateAdUnitPaths(context.adUnitPathVariables__);
    interstitial?.updateAdUnitPaths(context.adUnitPathVariables__);
    return Promise.resolve();
  });

  return {
    isSlotThrottled(slot: googletag.IAdSlot): boolean {
      return !!(
        adRequestThrottling?.isThrottled(slot.getSlotElementId()) ||
        frequencyCapping?.isAdUnitCapped(slot)
      );
    },
    isBidderFrequencyCappedOnSlot(slotId: string, bidder: prebidjs.BidderCode): boolean {
      return frequencyCapping?.isBidderCapped(slotId, bidder) ?? false;
    },
    getLastBidCpmsOfAdUnit(slotId: string): number[] {
      return previousBidCpms?.getLastBidCpms(slotId) ?? [];
    },
    getLastWinningBidderOfAdUnit(slotId: string): prebidjs.BidderCode | undefined {
      return trackWinningBidder?.getLastWinningBidderOnAdUnit(slotId);
    },
    isBidderDisabled(domId: string, bidder: prebidjs.BidderCode): boolean {
      return biddersDisabling?.isBidderDisabled(domId, bidder) ?? false;
    },
    interstitialChannel: (): auction.InterstitialChannel | null | undefined => {
      return interstitial?.interstitialChannel();
    },
    hasMinimumRequestAds(minRequestAds: number): boolean {
      if (!frequencyCapping) {
        return true;
      }
      const currentPageImpression = frequencyCapping.getTotalNumAdRequests();
      return currentPageImpression >= minRequestAds;
    },
    configureStep(): ConfigureStep {
      return configureStep;
    }
  };
};
