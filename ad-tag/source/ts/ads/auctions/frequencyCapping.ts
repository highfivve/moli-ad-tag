import { prebidjs } from '../../types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { auction } from '../../types/moliConfig';
import { NowInstant, remainingTime, ResumeCallbackData } from './resume';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { AdUnitPathVariables, resolveAdUnitPath } from '../adUnitPath';
import { googletag } from 'ad-tag/types/googletag';

/** store meta data for frequency capping feature */
const sessionStorageKey = 'h5v-fc';

type BidderAdUnitKey = `${string}:${string}`;

type FrequencyCappingPositionImpSchedules = ResumeCallbackData[];
type FrequencyCappingBidderImpSchedules = ResumeCallbackData[];

/**
 * The frequency capping config for a bidder, with the pacing interval included.
 */
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

export interface FrequencyCapping {
  onAuctionEnd(auction: prebidjs.event.AuctionObject): void;
  onBidWon(bid: prebidjs.BidResponse): void;
  onSlotRenderEnded(event: googletag.events.ISlotRenderEndedEvent): void;
  afterRequestAds(): void;
  updateAdUnitPaths(adUnitPathVariables: AdUnitPathVariables): void;
  isAdUnitCapped(adUnitPath: string): boolean;
  isFrequencyCapped(slotId: string, bidder: BidderCode): boolean;
}

const hasPacingInterval = (
  config: auction.BidderFrequencyCappingConfig
): config is BidderFrequencyCappingConfigWithPacingInterval =>
  !!config.conditions && !!config.conditions.pacingInterval;

export const createFrequencyCapping = (
  config: auction.FrequencyCappingConfig,
  _window: Window,
  now: NowInstant,
  logger: MoliRuntime.MoliLogger
): FrequencyCapping => {
  const positionImpSchedules: Map<string, FrequencyCappingPositionImpSchedules> = new Map();
  const bidderImpSchedules: Map<string, FrequencyCappingBidderImpSchedules> = new Map();
  let numAdRequests = 0;

  const pacingIntervalConfigs: BidderFrequencyCappingConfigWithPacingInterval[] =
    config.bidders?.filter(hasPacingInterval) ?? [];

  const bidWonConfigs =
    pacingIntervalConfigs.filter(
      config =>
        !config.conditions.pacingInterval?.events ||
        config.conditions.pacingInterval?.events?.includes('bidWon')
    ) ?? [];
  const bidRequestedConfigs =
    pacingIntervalConfigs.filter(config =>
      config.conditions.pacingInterval?.events?.includes('bidRequested')
    ) ?? [];
  let resolvedAdUnitPathPositionConfigs = config.positions || [];

  const persist = () => {
    if (config.persistent === true) {
      const data: PersistedFrequencyCappingState = {
        bCaps: Array.from(bidderImpSchedules.entries()).reduce<
          PersistedFrequencyCappingState['bCaps']
        >((acc, [key, schedules]) => ({ ...acc, [key]: schedules }), {}),
        pCaps: Array.from(positionImpSchedules.entries()).reduce<
          PersistedFrequencyCappingState['pCaps']
        >((acc, [adUnitPath, schedules]) => ({ ...acc, [adUnitPath]: schedules }), {}),
        requestAds: numAdRequests
      };
      _window.sessionStorage.setItem(sessionStorageKey, JSON.stringify(data));
    }
  };

  const cap = (
    startTimestamp: number,
    config: Pick<auction.BidderFrequencyCappingConfig, 'domId' | 'bidders'>,
    intervalInMs: number,
    bid: { bidder: string; adUnitCode: string }
  ) => {
    // Note: this bidderImpSchedules is actually a FIFO queue of timestamps. We may use push & shift
    // for better performance and less complexity.
    const bidders = config.bidders;
    if ((!bidders || bidders.includes(bid.bidder)) && config.domId === bid.adUnitCode) {
      const key: BidderAdUnitKey = `${bid.adUnitCode}:${bid.bidder}`;
      const currentSchedules = bidderImpSchedules.get(key) ?? [];
      currentSchedules.push({
        ts: startTimestamp,
        wait: intervalInMs
      });
      bidderImpSchedules.set(key, currentSchedules);

      // remove the entry after the interval
      _window.setTimeout(() => {
        logger.debug('fc', `removing ${key} at ${startTimestamp}`);
        const schedules = bidderImpSchedules.get(key);
        if (schedules) {
          // instead of filtering, we could also use shift() to remove the first element.
          // This would mean mutating in place - feels wrong though
          bidderImpSchedules.set(
            key,
            schedules.filter(s => s.ts !== startTimestamp)
          );
        }
      }, intervalInMs);

      persist();
    }
  };

  const capPosition = (
    startTimestamp: number,
    adUnitPath: string,
    pacingInterval: Pick<auction.PositionFrequencyConfigPacingInterval, 'intervalInMs'>
  ) => {
    const currentSchedules = positionImpSchedules.get(adUnitPath) ?? [];
    currentSchedules.push({ ts: startTimestamp, wait: pacingInterval.intervalInMs });
    positionImpSchedules.set(adUnitPath, currentSchedules);

    _window.setTimeout(() => {
      const schedules = positionImpSchedules.get(adUnitPath);
      if (schedules) {
        positionImpSchedules.set(
          adUnitPath,
          schedules.filter(s => s.ts !== startTimestamp)
        );
      }
    }, pacingInterval.intervalInMs);

    persist();
  };

  // initialize frequency caps from session storage if available
  if (config.persistent === true) {
    const storedData = _window.sessionStorage.getItem(sessionStorageKey);
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData) as PersistedFrequencyCappingState;
        numAdRequests = parsedData.requestAds;

        Object.entries(parsedData.bCaps).forEach(([adUnitBidderKey, schedules]) => {
          //
          schedules?.forEach(schedule => {
            const [adUnitCode, bidder] = adUnitBidderKey.split(':');
            const blockedForMs = remainingTime(schedule, now());
            cap(now(), { domId: adUnitCode, bidders: [bidder] }, blockedForMs, {
              bidder,
              adUnitCode
            });
          });
        });

        Object.entries(parsedData.pCaps).forEach(([adUnitPath, schedules]) => {
          schedules?.forEach(schedule => {
            const blockedForMs = remainingTime(schedule, now());
            capPosition(schedule.ts, adUnitPath, { intervalInMs: blockedForMs });
          });
        });
      } catch (e) {
        logger.error('fc', 'failed to parse fc state', e);
      }
    }
  }

  return {
    onAuctionEnd(auction: prebidjs.event.AuctionObject) {
      bidRequestedConfigs.forEach(config => {
        auction.bidderRequests?.forEach(bidderRequests => {
          bidderRequests?.bids?.forEach(bid => {
            cap(now(), config, config.conditions.pacingInterval.intervalInMs, bid);
          });
        });
      });
      persist();
    },

    onBidWon(bid: prebidjs.BidResponse) {
      bidWonConfigs.forEach(config =>
        cap(now(), config, config.conditions.pacingInterval.intervalInMs, bid)
      );
      persist();
    },

    onSlotRenderEnded(event: googletag.events.ISlotRenderEndedEvent) {
      if (!event.isEmpty) {
        const adUnitPath = event.slot.getAdUnitPath();
        const pacingInterval = resolvedAdUnitPathPositionConfigs.find(
          config => config.adUnitPath === adUnitPath
        )?.conditions.pacingInterval;
        if (pacingInterval) {
          capPosition(now(), adUnitPath, pacingInterval);
        }
      }
    },

    afterRequestAds() {
      numAdRequests++;
      persist();
    },

    updateAdUnitPaths(adUnitPathVariables: AdUnitPathVariables) {
      resolvedAdUnitPathPositionConfigs = (config.positions ?? []).map(config => {
        return { ...config, adUnitPath: resolveAdUnitPath(config.adUnitPath, adUnitPathVariables) };
      });
    },

    isAdUnitCapped(adUnitPath: string): boolean {
      return resolvedAdUnitPathPositionConfigs.some(positionConfig => {
        return (
          (positionConfig.adUnitPath === adUnitPath &&
            positionConfig.conditions.delay &&
            numAdRequests < positionConfig.conditions.delay.minRequestAds) ||
          (positionConfig.conditions.pacingRequestAds &&
            numAdRequests % positionConfig.conditions.pacingRequestAds.requestAds !== 0) ||
          (positionConfig.conditions.pacingInterval &&
            (positionImpSchedules.get(adUnitPath) ?? []).length >=
              positionConfig.conditions.pacingInterval.maxImpressions)
        );
      });
    },

    isFrequencyCapped(slotId: string, bidder: BidderCode): boolean {
      if (!config.bidders) {
        return false;
      }
      return config.bidders
        .filter(c => !c.bidders || (c.bidders.includes(bidder) && c.domId === slotId))
        .some(({ conditions: { pacingInterval, delay } }) => {
          return (
            // pacing interval condition: check if the number of impressions for this bidder on this slot exceeds the max impressions
            (pacingInterval &&
              (bidderImpSchedules.get(`${slotId}:${bidder}`) ?? []).length >=
                pacingInterval.maxImpressions) ||
            // delay condition: check if the number of ad requests is less than the minimum required for a request
            (delay && numAdRequests < delay.minRequestAds)
          );
        });
    }
  };
};
