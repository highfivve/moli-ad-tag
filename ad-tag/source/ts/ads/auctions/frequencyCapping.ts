import { prebidjs } from '../../types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { auction } from '../../types/moliConfig';
import { NowInstant, remainingTime, ResumeCallbackData } from './resume';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { AdUnitPathVariables, resolveAdUnitPath } from '../adUnitPath';
import { googletag } from 'ad-tag/types/googletag';

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

  /**
   * Ad unit paths can contain variables that need to be resolved at runtime.
   * The global auction context and hence the frequency capping is initialized early on.
   * Once the `adUnitPathVariables` are available, this method should be called, so ad unit paths
   * can be resolved from the config and matched against the ad unit paths in the auction.
   *
   * @param adUnitPathVariables
   */
  updateAdUnitPaths(adUnitPathVariables: AdUnitPathVariables): void;
  isAdUnitCapped(adUnitPath: string): boolean;
  isFrequencyCapped(slotId: string, bidder: BidderCode): boolean;
}

export const createFrequencyCapping = (
  config: auction.FrequencyCappingConfig,
  _window: Window,
  now: NowInstant,
  logger: MoliRuntime.MoliLogger
): FrequencyCapping => {
  const frequencyCaps: Map<string, FrequencyCappingBid> = new Map();
  const positionImpSchedules: Map<string, FrequencyCappingPositionImpSchedules> = new Map();
  let numAdRequests = 0;

  const bidWonConfigs = config.configs.filter(
    config => !config.events || config.events?.includes('bidWon')
  );
  const bidRequestedConfigs = config.configs.filter(config =>
    config.events?.includes('bidRequested')
  );
  let resolvedAdUnitPathPositionConfigs = config.positions || [];

  const persist = () => {
    if (config.persistent === true) {
      const data: PersistedFrequencyCappingState = {
        caps: Array.from(frequencyCaps.values()),
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
    config: auction.BidderFrequencyConfig,
    bid: { bidder: string; adUnitCode: string }
  ) => {
    if (config.bidder === bid.bidder && config.domId === bid.adUnitCode) {
      const key = `${bid.adUnitCode}:${bid.bidder}`;
      logger.debug('fc', `adding ${key}`);
      frequencyCaps.set(key, {
        ts: startTimestamp,
        wait: config.blockedForMs,
        bid: {
          bidder: bid.bidder,
          adUnitCode: bid.adUnitCode
        }
      });
      _window.setTimeout(() => {
        logger.debug('fc', `removing ${key}`);
        frequencyCaps.delete(key);
      }, config.blockedForMs);
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

  if (config.persistent === true) {
    const storedData = _window.sessionStorage.getItem(sessionStorageKey);
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData) as PersistedFrequencyCappingState;
        numAdRequests = parsedData.requestAds;

        parsedData.caps.forEach(data => {
          const blockedForMs = remainingTime(data, now());
          cap(
            data.ts,
            { bidder: data.bid.bidder, domId: data.bid.adUnitCode, blockedForMs },
            data.bid
          );
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
            cap(now(), config, bid);
          });
        });
      });
      persist();
    },

    onBidWon(bid: prebidjs.BidResponse) {
      bidWonConfigs.forEach(config => cap(now(), config, bid));
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
      return frequencyCaps.has(`${slotId}:${bidder}`);
    }
  };
};
