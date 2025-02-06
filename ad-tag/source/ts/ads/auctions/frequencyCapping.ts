import { prebidjs } from '../../types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { auction } from '../../types/moliConfig';
import { NowInstant, remainingTime, ResumeCallbackData } from './resume';

/** store meta data for frequency capping feature */
const sessionStorageKey = 'h5v-fc';

type FrequencyCappingBid = ResumeCallbackData & {
  readonly bid: { bidder: string; adUnitCode: string };
};

/**
 * The state of the frequency capping module is stored in a JSON array of the bidder/adunit key
 * that should be capped, along with the resume callback data, to re-schedule the callback if
 * the page is refreshed.
 *
 */
type PersistedFrequencyCappingState = {
  /**
   * The active frequency caps
   */
  readonly caps: FrequencyCappingBid[];
};

export class FrequencyCapping {
  /**
   * Stores the information that a bidder should not be requested again on a slot in the given time interval.
   *
   * Useful to prevent continuous reloads of a bidder on a slot, e.g. on the wallpaper or interstitial.
   * @private
   */
  private frequencyCaps: Map<string, FrequencyCappingBid> = new Map();

  private bidWonConfigs: auction.BidderFrequencyConfig[];
  private bidRequestedConfigs: auction.BidderFrequencyConfig[];

  constructor(
    private readonly config: auction.FrequencyCappingConfig,
    private readonly _window: Window & Pick<typeof globalThis, 'console'>,
    private readonly now: NowInstant
  ) {
    this.bidWonConfigs = this.config.configs.filter(
      config => !config.events || config.events?.includes('bidWon')
    );
    this.bidRequestedConfigs = this.config.configs.filter(config =>
      config.events?.includes('bidRequested')
    );
    if (config.persistent === true) {
      const storedData = this._window.sessionStorage.getItem(sessionStorageKey);
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData) as PersistedFrequencyCappingState;
          parsedData.caps.forEach(data => {
            const blockedForMs = remainingTime(data, this.now());
            this.#cap(
              // the start timestamp is taken from the stored data
              data.ts,
              // generate the config from the stored data. This is a bit of a hack, but it keeps the
              // caps method interface consistent
              { bidder: data.bid.bidder, domId: data.bid.adUnitCode, blockedForMs },
              // capping based on the previous bid data
              data.bid
            );
            // resume(data, now, () => this.frequencyCaps.delete(data.key), this._window);
          });
        } catch (e) {
          this._window.console.error('failed to parse fc state', e);
        }
      }
    }
  }

  onAuctionEnd(auction: prebidjs.event.AuctionObject) {
    this.bidRequestedConfigs.forEach(config => {
      auction.bidderRequests?.forEach(bidderRequests => {
        bidderRequests?.bids?.forEach(bid => {
          this.#cap(this.now(), config, bid);
        });
      });
    });
    this.#persist();
  }

  onBidWon(bid: prebidjs.BidResponse) {
    this.bidWonConfigs.forEach(config => this.#cap(this.now(), config, bid));
    this.#persist();
  }

  isFrequencyCapped(slotId: string, bidder: BidderCode): boolean {
    return this.frequencyCaps.has(`${slotId}:${bidder}`);
  }

  /**
   *
   * @param startTimestamp since when the capping should be active
   * @param config
   * @param bid
   * @private
   */
  #cap = (
    startTimestamp: number,
    config: auction.BidderFrequencyConfig,
    bid: { bidder: string; adUnitCode: string }
  ) => {
    if (config.bidder === bid.bidder && config.domId === bid.adUnitCode) {
      const key = `${bid.adUnitCode}:${bid.bidder}`;
      this.frequencyCaps.set(key, {
        ts: startTimestamp,
        wait: config.blockedForMs,
        bid: {
          bidder: bid.bidder,
          adUnitCode: bid.adUnitCode
        }
      });
      this._window.setTimeout(() => {
        this.frequencyCaps.delete(key);
      }, config.blockedForMs);
    }
  };

  #persist = () => {
    // store the state in session storage
    if (this.config.persistent === true) {
      const data: PersistedFrequencyCappingState = {
        caps: Array.from(this.frequencyCaps.values())
      };
      this._window.sessionStorage.setItem(sessionStorageKey, JSON.stringify(data));
    }
  };
}
