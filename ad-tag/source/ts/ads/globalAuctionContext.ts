import { Moli } from '../types/moli';
import { prebidjs } from '../types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { googletag } from '../types/googletag';

declare const window: Window & prebidjs.IPrebidjsWindow & googletag.IGoogleTagWindow;

export class GlobalAuctionContext {
  readonly enabled: boolean;
  private readonly bidderActivity: Map<string, Map<BidderCode, number>>; // Map of position to map of bidders and their activity timestamps
  private readonly ttlTimers: Map<string, Map<BidderCode, NodeJS.Timeout>>; // Map of position to map of bidders and their TTL timers

  constructor(
    private readonly config: Moli.auction.GlobalAuctionContextConfig = { enabled: false }
  ) {
    this.enabled = this.config.enabled;
    this.bidderActivity = new Map<string, Map<BidderCode, number>>();
    this.ttlTimers = new Map<string, Map<BidderCode, NodeJS.Timeout>>();

    // Register event listeners
    window.pbjs.onEvent('noBid', bid => this.handleNoBidEvent(bid.bidderCode, bid.adUnitCode));
    window.pbjs.onEvent('bidWon', bid =>
      this.handleBidWonEvent(bid.bidderCode, bid.adUnitCode, Date.now())
    );
    window.pbjs.onEvent('bidTimeout', bid =>
      this.handleTimeoutEvent(bid.bidderCode, bid.adUnitCode)
    );
    window.pbjs.onEvent('bidResponse', bid =>
      this.handleBidResponseEvent(bid.bidderCode, bid.adUnitCode)
    );
  }

  // Method to record bidder activity for a specific position
  private recordBidderActivity(
    bidder: BidderCode,
    position: string,
    timestamp: number = Date.now()
  ) {
    if (!this.bidderActivity.has(position)) {
      this.bidderActivity.set(position, new Map<BidderCode, number>());
    }
    this.bidderActivity.get(position)?.set(bidder, timestamp);
  }

  // Method to deactivate bidder for a certain time period (TTL) for a specific position
  private deactivateBidderForTTL(bidder: BidderCode, position: string, ttl: number) {
    if (this.bidderActivity.has(position) && this.bidderActivity.get(position)?.has(bidder)) {
      // Deactivate bidder
      this.bidderActivity.get(position)!.delete(bidder);

      // Clear existing TTL timer if any
      if (this.ttlTimers.has(position) && this.ttlTimers.get(position)?.has(bidder)) {
        clearTimeout(this.ttlTimers.get(position)?.get(bidder));
      }

      // Reactivate bidder after TTL
      const timer = setTimeout(() => {
        this.recordBidderActivity(bidder, position);
      }, ttl);

      // Save timer reference, so that it can be cleared if needed
      if (!this.ttlTimers.has(position)) {
        this.ttlTimers.set(position, new Map<BidderCode, NodeJS.Timeout>());
      }
      this.ttlTimers.get(position)?.set(bidder, timer);
    }
  }

  // Method to deactivate bidder for a specific position
  private deactivateBidder(bidder: BidderCode, position: string) {
    if (this.bidderActivity.has(position) && this.bidderActivity.get(position)?.has(bidder)) {
      this.bidderActivity.get(position)?.delete(bidder);

      // Clear TTL timer if exists
      if (this.ttlTimers.get(position)?.has(bidder)) {
        clearTimeout(this.ttlTimers.get(position)?.get(bidder));
        this.ttlTimers.get(position)?.delete(bidder);
      }
    }
  }

  private handleNoBidEvent(bidder: BidderCode, position: string) {
    this.deactivateBidder(bidder, position);
  }

  private handleBidWonEvent(bidder: BidderCode, position: string, timestamp: number) {
    this.recordBidderActivity(bidder, position, timestamp);
  }

  private handleTimeoutEvent(bidder: BidderCode, position: string) {
    this.deactivateBidder(bidder, position);
  }

  private handleBidResponseEvent(bidder: BidderCode, position: string) {
    if (!this.bidderActivity.has(position) || !this.bidderActivity.get(position)?.has(bidder)) {
      // Throttle bidder by deactivating for a certain time period
      this.deactivateBidderForTTL(bidder, position, 60000);
    }
  }
}
