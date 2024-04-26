import { prebidjs } from '../../types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { Moli } from '../../types/moli';

/**
 * This interface represents the state of a bidder for a specific position.
 */
type BidderState = {
  /**
   * true if bidder has been temporarily disabled due to lack of participation
   */
  disabled: boolean;

  /**
   * bid requests sent for this bidder in prebid so far
   */
  bidRequestCount: number;

  /**
   * bid responses received for this bidder in prebid. These are not won bids, just responses.
   */
  bidReceivedCount: number;
};

/**
 * This class is responsible for disabling bidders that have low bid rate.
 * It keeps track of the number of bid requests and bids received for each bidder for the corresponding position.
 * A bidder is disabled: if the bid rate is lower than the minimum rate and the number of bid requests is higher than the minimum bid requests.
 *
 * NOTE: This only works for client side auctions so far.
 *
 * @param config - configuration object
 * @param window - window object
 */
export class BiddersDisabling {
  private participationInfo: Map<string, Map<BidderCode, BidderState>> = new Map();
  private logger?: Moli.MoliLogger;
  constructor(
    private readonly config: Moli.auction.BidderDisablingConfig,
    private readonly window: Window
  ) {
    this.logger?.info(`Bidders disabling feature is ${config.enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Disable bidders that have low bid rate as specified in the configuration.
   * This method should be used to filter bid objects before an auction starts.
   *
   * Note that by default bidders are never disabled.
   *
   * @param position the DOM id of the ad unit that should be checked
   * @param bidderCode the prebid.js client side bidder code
   * @returns true if the bidder is disabled for the given position, false otherwise
   */
  public isBidderDisabled(position: string, bidderCode: BidderCode): boolean {
    return this.participationInfo.get(position)?.get(bidderCode)?.disabled ?? false;
  }

  /**
   * This method is called when the auction ends.
   * @param auction - auction object that contains information about the bids and bid requests.
   * For more info, execute => pbjs.getEvents().filter(event => (event.eventType === 'auctionEnd'))
   * or @see https://docs.prebid.org/dev-docs/publisher-api-reference/getEvents.html
   */
  public onAuctionEnd(auction: any): void {
    auction.bidderRequests.forEach(bidderRequest => {
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

    auction.bidsReceived.forEach(bidReceived => {
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
          }, this.config.reactivationPeriod);
        }
      });
    });
  }

  // check if bidder should be disabled based on the bid rate and the number of bid requests
  private shouldDisableBidder(bidderState: BidderState): boolean {
    return (
      bidderState.bidRequestCount > this.config.minBidRequests &&
      bidderState.bidReceivedCount / bidderState.bidRequestCount < this.config.minRate &&
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
}
