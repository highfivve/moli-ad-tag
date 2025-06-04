import { Moli } from '../../types/moli';
import auction = Moli.auction;
import { prebidjs } from '../../types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { NowInstant, remainingTime, ResumeCallbackData } from './resume';
import { googletag } from '../../types/googletag';
import { AdUnitPathVariables, resolveAdUnitPath } from '../adUnitPath';

/** store meta data for frequency capping feature */
const sessionStorageKey = 'h5v-fc';

type BidderAdUnitKey = `${string}:${string}`;

type FrequencyCappingPositionImpSchedules = ResumeCallbackData[];
type FrequencyCappingBidderImpSchedules = ResumeCallbackData[];

type BidderFrequencyCappingConfigWithPacingInterval = Omit<
  auction.BidderFrequencyCappingConfig,
  'conditions'
> & {
  conditions: Omit<auction.BidderFrequencyCappingConfig['conditions'], 'pacingInterval'> & {
    pacingInterval: auction.BidderFrequencyConfigPacingInterval;
  };
};

/**
 * The state of the frequency capping module is stored in a JSON array of the bidder/adunit key
 * that should be capped, along with the resume callback data, to re-schedule the callback if
 * the page is refreshed.
 *
 */
export type PersistedFrequencyCappingState = {
  /**
   * The active bidder impression schedules
   */
  readonly bCaps: { [key: BidderAdUnitKey]: FrequencyCappingBidderImpSchedules | undefined };

  /**
   * The active position impression schedules
   */
  readonly pCaps: { [adUnitPath: string]: FrequencyCappingPositionImpSchedules | undefined };

  /**
   * number of requestAds made so far
   */
  readonly requestAds: number;
};

export class FrequencyCapping {
  /**
   * Stores the number of impressions on a slot. Each entry in the list is a timestamp of the last impression
   * and a schedule to remove it.
   *
   * The length of the list of relevant impressions.
   *
   * @private
   */
  private positionImpSchedules: Map<string, FrequencyCappingPositionImpSchedules> = new Map();
  private bidderImpSchedules: Map<string, FrequencyCappingBidderImpSchedules> = new Map();

  private bidWonConfigs: BidderFrequencyCappingConfigWithPacingInterval[];
  private bidRequestedConfigs: BidderFrequencyCappingConfigWithPacingInterval[];
  private pacingIntervalConfigs: BidderFrequencyCappingConfigWithPacingInterval[];

  private resolvedAdUnitPathPositionConfigs: auction.PositionFrequencyConfig[];

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
    const hasPacingInterval = (
      config: auction.BidderFrequencyCappingConfig
    ): config is BidderFrequencyCappingConfigWithPacingInterval =>
      !!config.conditions && !!config.conditions.pacingInterval;

    this.pacingIntervalConfigs = config.bidders?.filter(hasPacingInterval) ?? [];

    this.bidWonConfigs =
      this.pacingIntervalConfigs?.filter(
        config =>
          !config.conditions.pacingInterval.events ||
          config.conditions.pacingInterval.events?.includes('bidWon')
      ) ?? [];
    this.bidRequestedConfigs =
      this.pacingIntervalConfigs?.filter(config =>
        config.conditions.pacingInterval.events?.includes('bidRequested')
      ) ?? [];

    this.resolvedAdUnitPathPositionConfigs = this.config.positions || [];

    if (config.persistent === true) {
      const storedData = this._window.sessionStorage.getItem(sessionStorageKey);
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData) as PersistedFrequencyCappingState;
          // restore the number of ad requests in this session
          this.numAdRequests = parsedData.requestAds;

          // re-schedule all the frequency caps
          Object.entries(parsedData.bCaps).forEach(([adUnitBidderKey, schedules]) => {
            //
            schedules?.forEach(schedule => {
              const [adUnitCode, bidder] = adUnitBidderKey.split(':');
              const blockedForMs = remainingTime(schedule, now());
              this.#cap(this.now(), { domId: adUnitCode, bidders: [bidder] }, blockedForMs, {
                bidder,
                adUnitCode
              });
            });
          });
          // reschedule frequency caps
          Object.entries(parsedData.pCaps).forEach(([adUnitPath, schedules]) => {
            schedules?.forEach(schedule => {
              const blockedForMs = remainingTime(schedule, this.now());
              // the start timestamp and waiting interval is taken from the stored data
              this.#capPosition(schedule.ts, adUnitPath, { intervalInMs: blockedForMs });
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
          this.#cap(this.now(), config, config.conditions.pacingInterval.intervalInMs, bid);
        });
      });
    });
    this.#persist();
  }

  onBidWon(bid: prebidjs.BidResponse) {
    this.bidWonConfigs.forEach(config =>
      this.#cap(this.now(), config, config.conditions.pacingInterval.intervalInMs, bid)
    );
    this.#persist();
  }

  onSlotRenderEnded(event: googletag.events.ISlotRenderEndedEvent) {
    if (!event.isEmpty) {
      // FIXME for the google web interstitial, the slot id is not the same as the ad unit code
      //       it can look like this 'gpt_unit_/33559401,22597236956/gutefrage/gf_interstitial/desktop/gutefrage.net_0'
      const adUnitPath = event.slot.getAdUnitPath();
      // 1. search if there's a pacing:interval config
      const pacingInterval = this.resolvedAdUnitPathPositionConfigs.find(
        config => config.adUnitPath === adUnitPath
      )?.conditions.pacingInterval;
      if (pacingInterval) {
        // 2. store the timestamp of the last impression as a schedule for persistence
        this.#capPosition(this.now(), adUnitPath, pacingInterval);
      }
      // the frequency capping check just needs to check if the impression count prohibits a new request
    }
  }

  afterRequestAds() {
    this.numAdRequests++;
    this.#persist();
  }

  /**
   * Updates all internal configurations that have ad unit paths with variables.
   * Should be called during every configure run
   * @param adUnitPathVariables
   */
  updateAdUnitPaths(adUnitPathVariables: AdUnitPathVariables) {
    this.resolvedAdUnitPathPositionConfigs = (this.config.positions ?? []).map(config => {
      return { ...config, adUnitPath: resolveAdUnitPath(config.adUnitPath, adUnitPathVariables) };
    });
  }

  isAdUnitCapped(adUnitPath: string): boolean {
    return this.resolvedAdUnitPathPositionConfigs.some(positionConfig => {
      return (
        (positionConfig.adUnitPath === adUnitPath &&
          // cap if minRequestAds is not reached yet
          positionConfig.conditions.delay &&
          this.numAdRequests < positionConfig.conditions.delay.minRequestAds) ||
        // cap if not at the right pacing interval yet
        (positionConfig.conditions.pacingRequestAds &&
          this.numAdRequests % positionConfig.conditions.pacingRequestAds.requestAds !== 0) ||
        // cap if the maxImpressions is reached in the current window
        (positionConfig.conditions.pacingInterval &&
          (this.positionImpSchedules.get(adUnitPath) ?? []).length >=
            positionConfig.conditions.pacingInterval.maxImpressions)
      );
    });
  }

  isFrequencyCapped(slotId: string, bidder: BidderCode): boolean {
    if (!this.config.bidders) {
      return false;
    }
    return this.config.bidders
      .filter(c => !c.bidders || (c.bidders.includes(bidder) && c.domId === slotId))
      .some(({ conditions: { pacingInterval, delay } }) => {
        return (
          // pacing interval condition: check if the number of impressions for this bidder on this slot exceeds the max impressions
          (pacingInterval &&
            (this.bidderImpSchedules.get(`${slotId}:${bidder}`) ?? []).length >=
              pacingInterval.maxImpressions) ||
          // delay condition: check if the number of ad requests is less than the minimum required for a request
          (delay && this.numAdRequests < delay.minRequestAds)
        );
      });
  }

  /**
   *
   * @param startTimestamp since when the capping should be active
   * @param config
   * @param intervalInMs
   * @param bid
   * @private
   */
  #cap = (
    startTimestamp: number,
    config: Pick<auction.BidderFrequencyCappingConfig, 'domId' | 'bidders'>,
    intervalInMs: number,
    bid: { bidder: string; adUnitCode: string }
  ) => {
    //
    // Note: this bidderImpSchedules is actually a FIFO queue of timestamps. We may use push & shift
    // for better performance and less complexity.
    const bidders = config.bidders;
    if ((!bidders || bidders.includes(bid.bidder)) && config.domId === bid.adUnitCode) {
      const key: BidderAdUnitKey = `${bid.adUnitCode}:${bid.bidder}`;
      const currentSchedules = this.bidderImpSchedules.get(key) ?? [];
      currentSchedules.push({
        ts: startTimestamp,
        wait: intervalInMs
      });
      this.bidderImpSchedules.set(key, currentSchedules);

      // remove the entry after the interval
      this._window.setTimeout(() => {
        this.logger.debug('fc', `removing ${key} at ${startTimestamp}`);
        const schedules = this.bidderImpSchedules.get(key);
        if (schedules) {
          // instead of filtering, we could also use shift() to remove the first element.
          // This would mean mutating in place - feels wrong though
          this.bidderImpSchedules.set(
            key,
            schedules.filter(s => s.ts !== startTimestamp)
          );
        }
      }, intervalInMs);

      this.#persist();
    }
  };

  #capPosition(
    startTimestamp: number,
    adUnitPath: string,
    pacingInterval: Pick<auction.PositionFrequencyConfigPacingInterval, 'intervalInMs'>
  ) {
    // 1. search if there's a pacing:interval config
    // 2. store the timestamp of the last impression as a schedule for persistence
    const currentSchedules = this.positionImpSchedules.get(adUnitPath) ?? [];
    currentSchedules.push({ ts: startTimestamp, wait: pacingInterval.intervalInMs });
    this.positionImpSchedules.set(adUnitPath, currentSchedules);
    // 3. schedule a callback to decrease the impression counter by 1
    this._window.setTimeout(() => {
      const schedules = this.positionImpSchedules.get(adUnitPath);
      if (schedules) {
        this.positionImpSchedules.set(
          adUnitPath,
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
        bCaps: Array.from(this.bidderImpSchedules.entries()).reduce<
          PersistedFrequencyCappingState['bCaps']
        >((acc, [key, schedules]) => ({ ...acc, [key]: schedules }), {}),
        pCaps: Array.from(this.positionImpSchedules.entries()).reduce<
          PersistedFrequencyCappingState['pCaps']
        >((acc, [adUnitPath, schedules]) => ({ ...acc, [adUnitPath]: schedules }), {}),
        requestAds: this.numAdRequests
      };
      this._window.sessionStorage.setItem(sessionStorageKey, JSON.stringify(data));
    }
  };
}
