import { Moli } from '../../types/moli';
import { prebidjs } from '../../types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { BidderState } from '../globalAuctionContext';

// This class is responsible for disabling bidders that have low bid rate.
export class BiddersDisablingConfig {
  constructor(
    private minBidRequests: number,
    private minRate: number,
    private participationInfo: Map<string, Map<BidderCode, BidderState>>,
    private deactivationTTL: number,
    private logger?: Moli.MoliLogger
  ) {}

  shouldDisableBidder(bidderState: BidderState): boolean {
    return (
      bidderState.bidRequestCount > this.minBidRequests &&
      bidderState.bidReceivedCount / bidderState.bidRequestCount < this.minRate &&
      !bidderState.disabled
    );
  }

  disableBidder(position: string, bidderCode: BidderCode) {
    const bidderState = this.participationInfo.get(position)?.get(bidderCode);
    if (bidderState) {
      bidderState.disabled = true;
      this.logger?.info(`Bidder ${bidderCode} for position ${position} is now disabled.`);
    }
  }

  enableBidder(position: string, bidderCode: BidderCode) {
    const bidderState = this.participationInfo.get(position)?.get(bidderCode);
    if (bidderState) {
      bidderState.disabled = false;
      this.logger?.info(`Bidder ${bidderCode} for position ${position} is now enabled.`);
    }
  }

  deactivateBidderForTTL() {
    this.participationInfo.forEach((bidders, position) => {
      bidders.forEach((bidderState, bidderCode) => {
        if (this.shouldDisableBidder(bidderState)) {
          this.disableBidder(position, bidderCode);

          setTimeout(() => {
            this.enableBidder(position, bidderCode);
          }, this.deactivationTTL);
        }
      });
    });
  }
}
