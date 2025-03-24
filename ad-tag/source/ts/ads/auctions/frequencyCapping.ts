import { Moli } from '../../types/moli';
import auction = Moli.auction;
import { prebidjs } from '../../types/prebidjs';
import BidderCode = prebidjs.BidderCode;

export class FrequencyCapping {
  /**
   * Stores the information that a bidder should not be requested again on a slot in the given time interval.
   *
   * Useful to prevent continuous reloads of a bidder on a slot, e.g. on the wallpaper or interstitial.
   * @private
   */
  private frequencyCaps: Set<string> = new Set();

  /**
   * Number of ad requests made so far
   * @private
   */
  private numAdRequests: number = 0;

  constructor(
    private readonly config: auction.FrequencyCappingConfig,
    private readonly _window: Window
  ) {}

  onBidWon(bid: prebidjs.BidResponse) {
    this.config.configs.forEach(config => {
      if (config.bidder === bid.bidder && config.domId === bid.adUnitCode) {
        const key = `${bid.adUnitCode}-${bid.bidder}`;
        this.frequencyCaps.add(key);

        this._window.setTimeout(() => {
          this.frequencyCaps.delete(key);
        }, config.blockedForMs);
      }
    });
  }

  onRequestAds() {
    this.numAdRequests++;
  }

  isFrequencyCapped(slotId: string, bidder: BidderCode): boolean {
    const isPositionCapped = this.config.positions.some(positionConfig => {
      return (
        positionConfig.domId === slotId &&
        positionConfig.conditions.every(predicate => {
          switch (predicate.condition) {
            case 'delay':
              return this.numAdRequests >= predicate.minRequestAds;
            case 'pacing:requestAds':
              return this.numAdRequests % predicate.requestAds === 0;
            case 'pacing:interval':
              // TODO requires timestamp of the last won impression or an interval set off once an impression
              //      is delivered on this position
              return false;
          }
        })
      );
    });
    return isPositionCapped && this.frequencyCaps.has(`${slotId}-${bidder}`);
  }
}
