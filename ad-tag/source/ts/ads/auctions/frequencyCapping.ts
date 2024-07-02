import { prebidjs } from 'ad-tag/types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { auction } from "ad-tag/types/moliConfig";

export class FrequencyCapping {
  /**
   * Stores the information that a bidder should not be requested again on a slot in the given time interval.
   *
   * Useful to prevent continuous reloads of a bidder on a slot, e.g. on the wallpaper or interstitial.
   * @private
   */
  private frequencyCaps: Set<string> = new Set();

  constructor(
    private readonly config: auction.FrequencyCappingConfig,
    private readonly _window: Window
  ) {}

  onBidWon(bid: prebidjs.BidResponse, configs: auction.BidderFrequencyConfig[]) {
    configs.forEach(config => {
      if (config.bidder === bid.bidder && config.domId === bid.adUnitCode) {
        const key = `${bid.adUnitCode}-${bid.bidder}`;
        this.frequencyCaps.add(key);

        this._window.setTimeout(() => {
          this.frequencyCaps.delete(key);
        }, config.blockedForMs);
      }
    });
  }

  isFrequencyCapped(slotId: string, bidder: BidderCode): boolean {
    return this.frequencyCaps.has(`${slotId}-${bidder}`);
  }
}
