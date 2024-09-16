import { Moli } from '../../types/moli';
import auction = Moli.auction;
import { prebidjs } from '../../types/prebidjs';
import BidResponse = prebidjs.event.BidResponse;

export class DynamicFloorPrices {
  /**
   * Stores the information about previous bid cpms.
   *
   * Used to calculate dynamic floor prices on the basis of previous bid cpms.
   * @private
   */
  private lastBidCpms: Map<string, number[]> = new Map();

  constructor(
    private readonly config: auction.DynamicFloorPricesConfig,
    private readonly _window: Window
  ) {}

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

  onAuctionEnd(bidsReceived: BidResponse[]) {
    const bidsOfLastAuction = this.groupReceivedBidsByAdUnitCode(bidsReceived);
    console.log('bidsOfLastAuction', bidsOfLastAuction);
    Object.entries(bidsOfLastAuction).forEach(([adUnitCode, cpms]) => {
      this.lastBidCpms.set(adUnitCode, cpms);
    });
  }

  getLastBidCpms(adUnitCode: string): number[] | null {
    return this.lastBidCpms.get(adUnitCode) ?? null;
  }
}
