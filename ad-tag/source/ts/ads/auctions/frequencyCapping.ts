import { Moli } from '../../types/moli';
import auction = Moli.auction;
import { prebidjs } from '../../types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { NowInstant, remainingTime, ResumeCallbackData } from './resume';
import { googletag } from '../../types/googletag';

/** store meta data for frequency capping feature */
const sessionStorageKey = 'h5v-fc';

type FrequencyCappingBid = ResumeCallbackData & {
  readonly bid: { bidder: string; adUnitCode: string };
};

type FrequencyCappingPositionImpSchedules = ResumeCallbackData[];

/**
 * The state of the frequency capping module is stored in a JSON array of the bidder/adunit key
 * that should be capped, along with the resume callback data, to re-schedule the callback if
 * the page is refreshed.
 *
 */
export type PersistedFrequencyCappingState = {
  /**
   * The active frequency caps
   */
  readonly caps: FrequencyCappingBid[];

  /**
   * The active position impression schedules
   */
  readonly pCaps: { [domId: string]: FrequencyCappingPositionImpSchedules | undefined };

  /**
   * number of requestAds made so far
   */
  readonly requestAds: number;
};

export class FrequencyCapping {
  /**
   * Stores the information that a bidder should not be requested again on a slot in the given time interval.
   *
   * Useful to prevent continuous reloads of a bidder on a slot, e.g. on the wallpaper or interstitial.
   * @private
   */
  private frequencyCaps: Map<string, FrequencyCappingBid> = new Map();

  /**
   * Stores the number of impressions on a slot. Each entry in the list is a timestamp of the last impression
   * and a schedule to remove it.
   *
   * The length of the list of relevant impressions.
   *
   * @private
   */
  private positionImpSchedules: Map<string, FrequencyCappingPositionImpSchedules> = new Map();

  private bidWonConfigs: auction.BidderFrequencyConfig[];
  private bidRequestedConfigs: auction.BidderFrequencyConfig[];

  /**
   * Number of ad requests made so far
   * @private
   */
  private numAdRequests: number = 0;

  constructor(
    private readonly config: auction.FrequencyCappingConfig,
    private readonly _window: Window,
    private readonly now: NowInstant,
    private readonly logger: Moli.MoliLogger
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
          // restore the number of ad requests in this session
          this.numAdRequests = parsedData.requestAds;

          // re-schedule all the frequency caps
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
          });
          // reschedule frequency caps
          Object.entries(parsedData.pCaps).forEach(([domId, schedules]) => {
            schedules?.forEach(schedule => {
              const blockedForMs = remainingTime(schedule, this.now());
              // the start timestamp and waiting interval is taken from the stored data
              this.#capPosition(schedule.ts, domId, { intervalInMs: blockedForMs });
            });
          });
        } catch (e) {
          this.logger.error('fc', 'failed to parse fc state', e);
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

  onSlotRenderEnded(event: googletag.events.ISlotRenderEndedEvent) {
    if (!event.isEmpty) {
      const slotId = event.slot.getSlotElementId();
      // 1. search if there's a pacing:interval config
      const pacingInterval = this.config.positions?.find(config => config.domId === slotId)
        ?.conditions.pacingInterval;
      if (pacingInterval) {
        // 2. store the timestamp of the last impression as a schedule for persistence
        this.#capPosition(this.now(), slotId, pacingInterval);
      }
      // the frequency capping check just needs to check if the impression count prohibits a new request
    }
  }

  afterRequestAds() {
    this.numAdRequests++;
    this.#persist();
  }

  isFrequencyCapped(slotId: string, bidder: BidderCode): boolean {
    const isPositionCapped = this.config.positions?.some(positionConfig => {
      return (
        (positionConfig.domId === slotId &&
          // cap if minRequestAds is not reached yet
          positionConfig.conditions.delay &&
          this.numAdRequests < positionConfig.conditions.delay.minRequestAds) ||
        // cap if not at the right pacing interval yet
        (positionConfig.conditions.pacingRequestAds &&
          this.numAdRequests % positionConfig.conditions.pacingRequestAds.requestAds !== 0) ||
        // cap if the maxImpressions is reached in the current window
        (positionConfig.conditions.pacingInterval &&
          (this.positionImpSchedules.get(slotId) ?? []).length >=
            positionConfig.conditions.pacingInterval.maxImpressions)
      );
    });
    return isPositionCapped || this.frequencyCaps.has(`${slotId}:${bidder}`);
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
      this.logger.debug('fc', `adding ${key}`);
      this.frequencyCaps.set(key, {
        ts: startTimestamp,
        wait: config.blockedForMs,
        bid: {
          bidder: bid.bidder,
          adUnitCode: bid.adUnitCode
        }
      });
      this._window.setTimeout(() => {
        this.logger.debug('fc', `removing ${key}`);
        this.frequencyCaps.delete(key);
      }, config.blockedForMs);
    }
  };

  #capPosition(
    startTimestamp: number,
    slotId: string,
    pacingInterval: Pick<auction.PositionFrequencyConfigPacingInterval, 'intervalInMs'>
  ) {
    // 1. search if there's a pacing:interval config
    // 2. store the timestamp of the last impression as a schedule for persistence
    const currentSchedules = this.positionImpSchedules.get(slotId) ?? [];
    currentSchedules.push({ ts: startTimestamp, wait: pacingInterval.intervalInMs });
    this.positionImpSchedules.set(slotId, currentSchedules);
    // 3. schedule a callback to decrease the impression counter by 1
    this._window.setTimeout(() => {
      const schedules = this.positionImpSchedules.get(slotId);
      if (schedules) {
        this.positionImpSchedules.set(
          slotId,
          schedules.filter(s => s.ts !== startTimestamp)
        );
      }
    }, pacingInterval.intervalInMs);
    // 3. persist state with resume callback data
    this.#persist();
  }

  #persist = () => {
    // store the state in session storage
    if (this.config.persistent === true) {
      const data: PersistedFrequencyCappingState = {
        caps: Array.from(this.frequencyCaps.values()),
        pCaps: Array.from(this.positionImpSchedules.entries()).reduce<
          PersistedFrequencyCappingState['pCaps']
        >((acc, [domId, schedules]) => ({ ...acc, [domId]: schedules }), {}),
        requestAds: this.numAdRequests
      };
      this._window.sessionStorage.setItem(sessionStorageKey, JSON.stringify(data));
    }
  };
}
