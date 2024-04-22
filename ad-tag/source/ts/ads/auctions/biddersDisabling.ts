import { prebidjs } from '../../types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { Moli } from '../../types/moli';

type BidderState = {
  disabled: boolean;
  bidRequestCount: number;
  bidReceivedCount: number;
};

/**
 * This class is responsible for disabling bidders that have low bid rate.
 * It keeps track of the number of bid requests and bids received for each bidder for the corresponding position.
 * Bidder if disabled: if the bid rate is lower than the minimum rate and the number of bid requests is higher than the minimum bid requests.
 * @param enabled - if the bidders disabling is enabled
 * @param minBidRequests - minimum number of bid requests for a bidder to be disabled if the bid rate is lower than the minimum rate
 * @param minRate - minimum bid rate for a bidder to be disabled
 * @param deactivationTTL - time in milliseconds after which the bidder is reactivated
 * @param window - window object
 */

export class BiddersDisabling {
  private participationInfo: Map<string, Map<BidderCode, BidderState>> = new Map();
  private logger?: Moli.MoliLogger;
  constructor(
    private readonly enabled: boolean,
    private minBidRequests: number,
    private minRate: number,
    private deactivationTTL: number,
    private readonly window: Window
  ) {}

  /**
   * This method is called when the auction ends.
   * @param auction - auction object that contains information about the bids and bid requests.
   * For more info, execute => pbjs.getEvents().filter(event => (event.eventType === 'auctionEnd'))
   * or @see https://docs.prebid.org/dev-docs/publisher-api-reference/getEvents.html
   */

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

  // check if bidder should be disabled based on the bid rate and the number of bid requests
  private shouldDisableBidder(bidderState: BidderState): boolean {
    return (
      bidderState.bidRequestCount > this.minBidRequests &&
      bidderState.bidReceivedCount / bidderState.bidRequestCount < this.minRate &&
      !bidderState.disabled
    );
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
}
