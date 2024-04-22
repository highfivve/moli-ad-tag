import { prebidjs } from '../../types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { googletag } from '../../types/googletag';
import { Moli } from '../../types/moli';

type BidderState = {
  disabled: boolean;
  bidRequestCount: number;
  bidReceivedCount: number;
};

// This class is responsible for disabling bidders that have low bid rate.
export class BiddersDisablingConfig {
  private participationInfo: Map<string, Map<BidderCode, BidderState>> = new Map();
  private logger?: Moli.MoliLogger;
  constructor(
    private readonly enabled: boolean,
    private minBidRequests: number,
    private minRate: number,
    private deactivationTTL: number,
    private readonly window: Window & prebidjs.IPrebidjsWindow & googletag.IGoogleTagWindow
  ) {}

  public onAuctionEnd(auction: any): void {
    auction.args.bidderRequests.forEach(bidderRequest => {
      // iterate over all bids and in each bid request and update participationInfo
      bidderRequest.bids.forEach(bid => {
        const bidderCode = bid.bidderCode;
        const positions = bid.bids.map(bid => bid.adUnitCode);

        positions.forEach(position => {
          const foundPosition = this.participationInfo.get(position);
          if (!foundPosition) {
            this.participationInfo.set(position, new Map());
          }

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
    });

    auction.args.bidsReceived.forEach(bidReceived => {
      const bidderForPosition = bidReceived.bidderCode;
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
    // deactivate bidders that should be disabled after updating participationInfo, and schedule their reactivation
    this.deactivateBidderForTTL();
  }

  public isBidderDisabled(position: string, bidderCode: BidderCode): boolean | undefined {
    // check participation
    const bidder = this.participationInfo.get(position)?.get(bidderCode);
    // bidder is not in the participationInfo config
    if (!bidder) {
      return undefined;
    }
    return bidder.disabled;
  }

  // check if bidder should be disabled based on the bid rate and the number of bid requests
  private shouldDisableBidder(bidderState: BidderState): boolean {
    return (
      bidderState.bidRequestCount > this.minBidRequests &&
      bidderState.bidReceivedCount / bidderState.bidRequestCount < this.minRate &&
      !bidderState.disabled
    );
  }

  private disableBidder(position: string, bidderCode: BidderCode) {
    const bidderState = this.participationInfo.get(position)?.get(bidderCode);
    if (bidderState) {
      bidderState.disabled = true;
      this.logger?.info(`Bidder ${bidderCode} for position ${position} is now disabled.`);
    }
  }

  private enableBidder(position: string, bidderCode: BidderCode) {
    const bidderState = this.participationInfo.get(position)?.get(bidderCode);
    if (bidderState) {
      bidderState.disabled = false;
      this.logger?.info(`Bidder ${bidderCode} for position ${position} is now enabled.`);
    }
  }

  private deactivateBidderForTTL() {
    this.participationInfo.forEach((bidders, position) => {
      bidders.forEach((bidderState, bidderCode) => {
        if (this.shouldDisableBidder(bidderState)) {
          this.disableBidder(position, bidderCode);

          this.window.setTimeout(() => {
            this.enableBidder(position, bidderCode);
          }, this.deactivationTTL);
        }
      });
    });
  }
}
