import { Moli } from '../types/moli';
import { prebidjs } from '../types/prebidjs';
import { googletag } from '../types/googletag';
import BidderCode = prebidjs.BidderCode;
import { BiddersDisablingConfig } from './auctions/biddersDisabling';

export type BidderState = {
  disabled: boolean;
  bidRequestCount: number;
  bidReceivedCount: number;
};

export class GlobalAuctionContext {
  readonly enabled: boolean;
  readonly minRate: number;
  readonly minBidRequests: number;
  private logger?: Moli.MoliLogger;
  private auctionsCount = 0;
  private participationInfo: Map<string, Map<BidderCode, BidderState>> = new Map(); // Map of position to map of bidders and their states
  private biddersDisablingConfig: BiddersDisablingConfig;

  constructor(
    private readonly window: Window & prebidjs.IPrebidjsWindow & googletag.IGoogleTagWindow,
    private readonly config: Moli.auction.GlobalAuctionContextConfig = {
      enabled: false,
      minRate: 0,
      minBidRequests: 0,
      deactivationTTL: 0
    }
  ) {
    this.enabled = this.config.enabled;
    this.minRate = this.config.minRate;
    this.minBidRequests = this.config.minBidRequests;

    this.biddersDisablingConfig = new BiddersDisablingConfig(
      this.minBidRequests,
      this.minRate,
      this.participationInfo,
      this.config.deactivationTTL,
      this.logger
    );

    this.window.pbjs = this.window.pbjs || { que: [] };

    // Register events, if enabled
    if (this.config.enabled) {
      this.window.pbjs.que.push(() => {
        this.window.pbjs.onEvent('auctionEnd', auctions => {
          console.log(auctions);
          auctions.forEach(auction => this.handleAuctionEndEvent(auction));
        });
      });
    }
  }

  // Handle auction end event and update participationInfo accordingly
  private handleAuctionEndEvent(auction: any) {
    // increase auctions count for each auction end event
    this.auctionsCount++;

    auction.args.bidderRequests.forEach(bidderRequest => {
      // iterate over all bids and in each bid request and update participationInfo
      bidderRequest.bids.forEach(bid => {
        const bidderCode = bid.BidderCode;
        const positions = bid.bids.map(bid => bid.adUnitCode);

        positions.forEach(position => {
          const bidderState = this.participationInfo.get(position)?.get(bidderCode);

          if (bidderState) {
            const newBidRequestCount = bidderState.bidRequestCount + 1;

            this.participationInfo.get(position)?.set(bidderCode, {
              ...bidderState,
              bidRequestCount: newBidRequestCount
            });
          } else {
            this.participationInfo.get(position)?.set(bidderCode, {
              disabled: false,
              bidRequestCount: 1,
              bidReceivedCount: 0
            });
          }
        });
      });

      auction.args.bidsReceived.forEach(bidReceived => {
        const bidderForPosition = bidReceived.BidderCode;
        const position = bidReceived.adUnitCode;

        const bidderState = this.participationInfo.get(position)?.get(bidderForPosition);
        if (bidderState) {
          this.participationInfo.get(position)?.set(bidderForPosition, {
            ...bidderState,
            bidReceivedCount: bidderState.bidReceivedCount + 1
          });
        } else {
          this.participationInfo.get(position)?.set(bidderForPosition, {
            disabled: false,
            bidRequestCount: 1,
            bidReceivedCount: 1
          });
        }
      });

      // deactivate bidders if they have not participated in the auction
      this.biddersDisablingConfig.deactivateBidderForTTL();
    });
  }
}
