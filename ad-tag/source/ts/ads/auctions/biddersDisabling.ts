import { prebidjs } from '../../types/prebidjs';
import { MoliRuntime } from '../../types/moliRuntime';
import { auction } from '../../types/moliConfig';

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
export interface BiddersDisabling {
  /**
   * Disable bidders that have low bid rate as specified in the configuration.
   * This method should be used to filter bid objects before an auction starts.
   *
   * Note that by default bidders are never disabled.
   *
   * @param domId the DOM id of the ad unit that should be checked
   * @param bidderCode the prebid.js client side bidder code
   * @returns true if the bidder is disabled for the given position, false otherwise
   */
  isBidderDisabled(domId: string, bidderCode: prebidjs.BidderCode): boolean;

  /**
   * prebid.js event handler that is called when an auction ends.
   * Mutates the internal state of the bidders disabling feature.
   */
  onAuctionEnd(auction: prebidjs.event.AuctionObject): void;
}

export const createBiddersDisabling = (
  config: auction.BidderDisablingConfig,
  window: Window,
  logger?: MoliRuntime.MoliLogger
): BiddersDisabling => {
  const participationInfo: Map<string, Map<prebidjs.BidderCode, BidderState>> = new Map();

  logger?.info(`Bidders disabling feature is ${config.enabled ? 'enabled' : 'disabled'}`);

  const isBidderDisabled = (domId: string, bidderCode: prebidjs.BidderCode): boolean => {
    if (config.excludedPositions?.includes(domId)) {
      return false;
    }

    return participationInfo.get(domId)?.get(bidderCode)?.disabled ?? false;
  };

  const onAuctionEnd = (auction: prebidjs.event.AuctionObject): void => {
    auction.bidderRequests?.forEach(bidderRequest => {
      bidderRequest?.bids?.forEach(bid => {
        const bidderCode = bid.bidder;
        const adUnitCode = bid.adUnitCode;

        if (!participationInfo.get(adUnitCode)) {
          participationInfo.set(adUnitCode, new Map());
        }

        const bidderState = participationInfo.get(adUnitCode)?.get(bidderCode);

        if (bidderState) {
          const newBidRequestCount = bidderState.bidRequestCount + 1;

          participationInfo.get(adUnitCode)?.set(bidderCode, {
            ...bidderState,
            bidRequestCount: newBidRequestCount
          });
        } else {
          participationInfo.get(adUnitCode)?.set(bidderCode, {
            disabled: false,
            bidRequestCount: 1,
            bidReceivedCount: 0
          });
        }
      });
    });

    auction.bidsReceived?.forEach(bidReceived => {
      const bidderForPosition = bidReceived.bidderCode;
      const position = bidReceived.adUnitCode;

      const bidderState = participationInfo.get(position)?.get(bidderForPosition);
      if (bidderState) {
        participationInfo.get(position)?.set(bidderForPosition, {
          ...bidderState,
          bidReceivedCount: bidderState.bidReceivedCount + 1
        });
      } else {
        participationInfo.get(position)?.set(bidderForPosition, {
          disabled: false,
          bidRequestCount: 1,
          bidReceivedCount: 1
        });
      }
    });

    deactivateBidderForTTL();
  };

  const deactivateBidderForTTL = () => {
    participationInfo.forEach((bidders, position) => {
      bidders.forEach((bidderState, bidderCode) => {
        if (shouldDisableBidder(bidderState)) {
          disableBidder(position, bidderCode);

          window.setTimeout(() => {
            enableBidder(position, bidderCode);
          }, config.reactivationPeriod);
        }
      });
    });
  };

  const shouldDisableBidder = (bidderState: BidderState): boolean => {
    return (
      bidderState.bidRequestCount > config.minBidRequests &&
      bidderState.bidReceivedCount / bidderState.bidRequestCount < config.minRate &&
      !bidderState.disabled
    );
  };

  const disableBidder = (position: string, bidderCode: prebidjs.BidderCode) => {
    const bidderState = participationInfo.get(position)?.get(bidderCode);
    if (bidderState) {
      bidderState.disabled = true;
      logger?.info(`Bidder ${bidderCode} for position ${position} is now disabled.`);
    }
  };

  const enableBidder = (position: string, bidderCode: prebidjs.BidderCode) => {
    const bidderState = participationInfo.get(position)?.get(bidderCode);
    if (bidderState) {
      bidderState.disabled = false;
      logger?.info(`Bidder ${bidderCode} for position ${position} is now enabled.`);
    }
  };

  return {
    isBidderDisabled,
    onAuctionEnd
  };
};
