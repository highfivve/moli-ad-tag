import { Moli } from '../../types/moli';
import auction = Moli.auction;
import { prebidjs } from '../../types/prebidjs';
import BidObject = prebidjs.event.BidObject;
import BidderFrequencyConfig = Moli.auction.BidderFrequencyConfig;
import BidderCode = prebidjs.BidderCode;

export class FrequencyCapping {
  /**
   * stores the information if a slot was requested and should not be requested again
   * @private
   */
  private frequencyCaps: Set<string> = new Set();

  constructor(
    private readonly config: auction.FrequencyCappingConfig,
    private readonly _window: Window
  ) {}

  onBidWon(bid: BidObject, configs: BidderFrequencyConfig[]) {
    configs.forEach(config => {
      if (config.bidder === bid.bidder && config.domId === bid.adUnitCode) {
        const key = `${bid.adUnitCode}-${bid.bidder}`;
        this.frequencyCaps.add(`${key}`);

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
