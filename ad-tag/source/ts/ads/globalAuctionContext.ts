import { prebidjs } from '../types/prebidjs';
import { googletag } from '../types/googletag';
import { createBiddersDisabling } from './auctions/biddersDisabling';
import { createAdRequestThrottling } from './auctions/adRequestThrottling';
import { auction } from '../types/moliConfig';
import { createFrequencyCapping } from './auctions/frequencyCapping';
import { createPreviousBidCpms } from './auctions/previousBidCpms';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { EventService } from './eventService';
import { ConfigureStep, mkConfigureStep } from './adPipeline';
import { createInterstitialContext } from 'ad-tag/ads/auctions/interstitialContext';

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

  isBidderDisabled(domId: string, bidder: prebidjs.BidderCode): boolean;

  isBidderFrequencyCappedOnSlot(slotId: string, bidder: prebidjs.BidderCode): boolean;

  interstitialChannel(): auction.InterstitialChannel | null | undefined;

  configureStep(): ConfigureStep;
}

export const createGlobalAuctionContext = (
  window: Window &
    prebidjs.IPrebidjsWindow &
    googletag.IGoogleTagWindow &
    Pick<typeof globalThis, 'Date'>,
  logger: MoliRuntime.MoliLogger,
  eventService: EventService,
  config: auction.GlobalAuctionContextConfig = {}
): GlobalAuctionContext => {
  const biddersDisabling = config.biddersDisabling?.enabled
    ? createBiddersDisabling(config.biddersDisabling, window)
    : undefined;

  const adRequestThrottling = config.adRequestThrottling?.enabled
    ? createAdRequestThrottling(config.adRequestThrottling, window)
    : undefined;

  const frequencyCapping = config.frequencyCap?.enabled
    ? createFrequencyCapping(config.frequencyCap, window, window.Date.now, logger)
    : undefined;

  const previousBidCpms = config.previousBidCpms?.enabled ? createPreviousBidCpms() : undefined;

  const interstitial = config.interstitial?.enabled
    ? createInterstitialContext(config.interstitial, window, window.Date.now, logger)
    : undefined;

  // Ensure pbjs and googletag are initialized
  window.pbjs = window.pbjs || ({ que: [] } as unknown as prebidjs.IPrebidJs);
  window.googletag = window.googletag || ({} as unknown as googletag.IGoogleTag);
  window.googletag.cmd = window.googletag.cmd || [];

  // Register events
  if (
    config.biddersDisabling?.enabled ||
    config.previousBidCpms?.enabled ||
    config.frequencyCap?.enabled ||
    config.interstitial?.enabled
  ) {
    window.pbjs.que.push(() => {
      window.pbjs.onEvent('auctionEnd', auction => {
        biddersDisabling?.onAuctionEnd(auction);
        interstitial?.onAuctionEnd(auction);
        if (config.previousBidCpms?.enabled && auction.bidsReceived) {
          previousBidCpms?.onAuctionEnd(auction.bidsReceived);
        }
        frequencyCapping?.onAuctionEnd(auction);
      });
    });
  }

  if (config.adRequestThrottling?.enabled || config.frequencyCap?.enabled) {
    window.googletag.cmd.push(() => {
      window.googletag.pubads().addEventListener('slotRequested', event => {
        adRequestThrottling?.onSlotRequested(event);
        frequencyCapping?.onSlotRequested(event);
      });
    });
  }

  if (config.frequencyCap?.enabled) {
    window.pbjs.que.push(() => {
      window.pbjs.onEvent('bidWon', bid => {
        if (config.frequencyCap) {
          frequencyCapping?.onBidWon(bid);
        }
      });
    });

    eventService.addEventListener('beforeRequestAds', () => {
      frequencyCapping?.beforeRequestAds();
    });
    eventService.addEventListener('afterRequestAds', () => {
      frequencyCapping?.afterRequestAds();
    });
  }

  if (config.frequencyCap?.enabled || config.interstitial?.enabled) {
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
    isBidderDisabled(domId: string, bidder: prebidjs.BidderCode): boolean {
      return biddersDisabling?.isBidderDisabled(domId, bidder) ?? false;
    },
    interstitialChannel: (): auction.InterstitialChannel | null | undefined => {
      return interstitial?.interstitialChannel();
    },
    configureStep(): ConfigureStep {
      return configureStep;
    }
  };
};
