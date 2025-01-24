import { prebidjs } from '../../types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { auction } from '../../types/moliConfig';
import BidderFrequencyConfig = auction.BidderFrequencyConfig;

export class FrequencyCapping {
  /**
   * Stores the information that a bidder should not be requested again on a slot in the given time interval.
   *
   * Useful to prevent continuous reloads of a bidder on a slot, e.g. on the wallpaper or interstitial.
   * @private
   */
  private frequencyCaps: Set<string> = new Set();

  private bidWonConfigs: auction.BidderFrequencyConfig[];
  private bidRequestedConfigs: auction.BidderFrequencyConfig[];

  constructor(
    private readonly config: auction.FrequencyCappingConfig,
    private readonly _window: Window
  ) {
    this.bidWonConfigs = this.config.configs.filter(
      config => !config.events || config.events?.includes('bidWon')
    );
    this.bidRequestedConfigs = this.config.configs.filter(config =>
      config.events?.includes('bidRequested')
    );
  }

  onAuctionEnd(auction: prebidjs.event.AuctionObject) {
    this.bidRequestedConfigs.forEach(config => {
      auction.bidderRequests?.forEach(bidderRequests => {
        bidderRequests?.bids?.forEach(bid => {
          this.#cap(config, bid);
        });
      });
    });
  }

  onBidWon(bid: prebidjs.BidResponse) {
    this.bidWonConfigs.forEach(config => this.#cap(config, bid));
  }

  isFrequencyCapped(slotId: string, bidder: BidderCode): boolean {
    return this.frequencyCaps.has(`${slotId}-${bidder}`);
  }

  #cap = (config: BidderFrequencyConfig, bid: { bidder: string; adUnitCode: string }) => {
    if (config.bidder === bid.bidder && config.domId === bid.adUnitCode) {
      const key = `${bid.adUnitCode}-${bid.bidder}`;
      this.frequencyCaps.add(key);

      this._window.setTimeout(() => {
        this.frequencyCaps.delete(key);
      }, config.blockedForMs);
    }
  };
}
