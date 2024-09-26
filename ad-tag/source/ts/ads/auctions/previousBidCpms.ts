import { prebidjs } from '../../types/prebidjs';
import BidResponse = prebidjs.event.BidResponse;

export class PreviousBidCpms {
  /**
   * Stores the information about previous bid cpms.
   *
   * Used to calculate dynamic floor prices on the basis of previous bid cpms.
   * @private
   */
  private lastBidCpms: Map<string, number[]> = new Map();
  /**
   * Processes a list of bid responses and groups them by their adUnitCode.
   * Each adUnitCode will be associated with an array of cpm values from the bid responses.
   */
  groupReceivedBidsByAdUnitCode(bidsReceived: BidResponse[]): { [key: string]: number[] } {
    return bidsReceived.reduce((result, current) => {
      const { adUnitCode, cpm } = current;
      if (!result[adUnitCode]) {
        result[adUnitCode] = [];
      }
      result[adUnitCode].push(cpm);
      return result;
    }, {});
  }

  /**
   * Handles the end of an auction by processing the received bid responses.
   *
   * This method groups the received bids by their ad unit code and updates the internal
   * storage of previous bid CPMs for each ad unit. It ensures that the CPMs from the
   * latest auction are appended to the existing CPMs for each ad unit. The CPMs array
   * should only include unique values. If no CPMs are received for an ad unit, the
   * corresponding entry in the map is deleted.
   *
   * @param bidsReceived - An array of bid responses received at the end of the auction.
   * Each bid response contains information such as the ad unit code and the CPM value.
   */
  onAuctionEnd(bidsReceived: BidResponse[]) {
    const bidsOfLastAuction = this.groupReceivedBidsByAdUnitCode(bidsReceived);

    /*
      if there are cpms saved for an adUnit that did not get bids in the current auction, delete them
      in order to prevent too high floor prices that lead to no bids
    */
    this.lastBidCpms.forEach((_, key) => {
      if (!bidsOfLastAuction[key]) {
        this.lastBidCpms.delete(key);
      }
    });

    Object.entries(bidsOfLastAuction).forEach(([adUnitCode, cpmsOfLastAuction]) => {
      const earlierCpmsOnPosition = this.getLastBidCpms(adUnitCode) ?? [];
      this.lastBidCpms.set(
        adUnitCode,
        Array.from(new Set([...cpmsOfLastAuction, ...earlierCpmsOnPosition]))
      );
    });
  }

  getLastBidCpms(adUnitCode: string): number[] | null {
    return this.lastBidCpms.get(adUnitCode) ?? null;
  }
}
