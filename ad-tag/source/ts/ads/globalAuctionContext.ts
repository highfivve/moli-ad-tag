import { Moli } from '../types/moli';
import { prebidjs } from '../types/prebidjs';
import { googletag } from '../types/googletag';
import { BiddersDisabling } from './auctions/biddersDisabling';
import { AdRequestThrottling } from './auctions/adRequestThrottling';
import { FrequencyCapping } from './auctions/frequencyCapping';
import { PreviousBidCpms } from './auctions/previousBidCpms';
import { EventService } from './eventService';
import { ConfigureStep, mkConfigureStep } from './adPipeline';
import { InterstitialContextImpl } from './auctions/interstitialContext';
import auction = Moli.auction;

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
export class GlobalAuctionContext {
  readonly biddersDisabling?: BiddersDisabling;
  readonly adRequestThrottling?: AdRequestThrottling;
  readonly frequencyCapping?: FrequencyCapping;
  readonly previousBidCpms?: PreviousBidCpms;
  readonly interstitial?: InterstitialContextImpl;

  /**
   * The ad unit path variables that are used to resolve the ad unit path.
   * They are at least partially created at runtime, which is why they are a mutable field here and
   * are updated during every configure ad pipeline run.
   *
   * This allows the global auction context to resolve ad unit paths if they contain variables.
   * @private
   */
  #configureStep = mkConfigureStep('GlobalAuctionContext', context => {
    this.frequencyCapping?.updateAdUnitPaths(context.adUnitPathVariables);
    return Promise.resolve();
  });

  constructor(
    private readonly window: Window &
      prebidjs.IPrebidjsWindow &
      googletag.IGoogleTagWindow &
      Pick<typeof globalThis, 'Date'>,
    private readonly logger: Moli.MoliLogger,
    private readonly eventService: EventService,
    private readonly config: Moli.auction.GlobalAuctionContextConfig = {}
  ) {
    if (config.biddersDisabling?.enabled) {
      this.biddersDisabling = new BiddersDisabling(config.biddersDisabling, this.window);
    }

    if (config.adRequestThrottling?.enabled) {
      this.adRequestThrottling = new AdRequestThrottling(config.adRequestThrottling, this.window);
    }

    if (config.frequencyCap?.enabled) {
      this.frequencyCapping = new FrequencyCapping(
        config.frequencyCap,
        this.window,
        this.window.Date.now,
        this.logger
      );
    }

    if (config.previousBidCpms?.enabled) {
      this.previousBidCpms = new PreviousBidCpms();
    }

    if (config.interstitial?.enabled) {
      this.interstitial = new InterstitialContextImpl(
        config.interstitial,
        this.window,
        this.window.Date.now,
        this.logger
      );
    }

    // FIXME we need to make sure that pbjs.que and googletag.que are initialized globally in moli ad tag, so we don't
    //       have to put this init code across the entire codebase
    this.window.pbjs = this.window.pbjs || ({ que: [] } as unknown as prebidjs.IPrebidJs);
    this.window.googletag =
      this.window.googletag || ({ cmd: [] } as unknown as googletag.IGoogleTag);

    // Register events, if enabled
    if (
      this.config.biddersDisabling?.enabled ||
      this.config.previousBidCpms?.enabled ||
      this.config.frequencyCap?.enabled ||
      config.interstitial?.enabled
    ) {
      this.window.pbjs.que.push(() => {
        this.window.pbjs.onEvent('auctionEnd', auction => {
          this.biddersDisabling?.onAuctionEnd(auction);
          if (config.previousBidCpms?.enabled && auction.bidsReceived) {
            this.previousBidCpms?.onAuctionEnd(auction.bidsReceived);
          }
          this.frequencyCapping?.onAuctionEnd(auction);
          this.interstitial?.onAuctionEnd(auction);
        });
      });
    }

    if (this.config.adRequestThrottling?.enabled) {
      this.window.googletag.cmd.push(() => {
        this.window.googletag.pubads().addEventListener('slotRequested', event => {
          this.adRequestThrottling?.onSlotRequested(event);
        });
      });
    }

    if (this.config.frequencyCap?.enabled) {
      this.window.pbjs.que.push(() => {
        this.window.pbjs.onEvent('bidWon', bid => {
          if (this.config.frequencyCap) {
            this.frequencyCapping?.onBidWon(bid);
          }
        });
      });

      this.eventService.addEventListener('afterRequestAds', () => {
        this.frequencyCapping?.afterRequestAds();
      });
    }

    if (this.config?.frequencyCap?.enabled || this.config.interstitial?.enabled) {
      this.window.googletag.cmd.push(() => {
        this.window.googletag.pubads().addEventListener('slotRenderEnded', event => {
          this.frequencyCapping?.onSlotRenderEnded(event);
          this.interstitial?.onSlotRenderEnded(event);
        });

        this.window.googletag.pubads().addEventListener('impressionViewable', event => {
          this.frequencyCapping?.onImpressionViewable(event);
        });
      });
    }
  }

  /**
   *
   *  @param slot The GPT ad slot to check
   */
  isSlotThrottled(slot: googletag.IAdSlot): boolean {
    return !!(
      this.adRequestThrottling?.isThrottled(slot.getSlotElementId()) ||
      this.frequencyCapping?.isAdUnitCapped(slot)
    );
  }

  isBidderFrequencyCappedOnSlot(slotId: string, bidder: prebidjs.BidderCode): boolean {
    return this.frequencyCapping?.isBidderCapped(slotId, bidder) ?? false;
  }

  getLastBidCpmsOfAdUnit(slotId: string): number[] {
    return this.previousBidCpms?.getLastBidCpms(slotId) ?? [];
  }

  interstitialChannel(): auction.InterstitialChannel | null | undefined {
    return this.interstitial?.interstitialChannel();
  }

  configureStep(): ConfigureStep {
    return this.#configureStep;
  }
}
