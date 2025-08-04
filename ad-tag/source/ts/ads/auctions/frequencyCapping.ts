import { prebidjs } from '../../types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { auction } from '../../types/moliConfig';
import { NowInstant, remainingTime, ResumeCallbackData } from './resume';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { AdUnitPathVariables, resolveAdUnitPath } from '../adUnitPath';
import { googletag } from 'ad-tag/types/googletag';
import { formatKey } from 'ad-tag/ads/keyValues';

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

  /**
   * Required for google web interstitials to capture if an impression was actually rendered.
   * The rendered event fires even if the ad was not rendered.
   */
  onImpressionViewable(event: googletag.events.IImpressionViewableEvent): void;
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
  const positionLastImpressionNumberOfAdRequests: Map<string, number> = new Map();
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

  const onSlotRenderEndedOrImpressionViewable = (adUnitPath: string) => {
    resolvedAdUnitPathPositionConfigs
      .filter(config => config.adUnitPath === adUnitPath)
      .forEach(config => {
        // what
        if (config.conditions.pacingInterval) {
          // store the timestamp of the last impression as a schedule for persistence
          capPosition(now(), adUnitPath, config.conditions.pacingInterval);
        }
        // store the number of ad requests for this position. Doesn't matter we persist multiple times
        // as the numAdRequests should not change. And there's rarely more than one config for a position
        if (config.conditions.pacingRequestAds) {
          positionLastImpressionNumberOfAdRequests.set(adUnitPath, numAdRequests);
          persist();
        }
      });
  };

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
      // check if the ad unit path is configured with a pacing:interval
      const [format] = event.slot.getTargeting(formatKey);
      if (
        !event.isEmpty && // for the Google interstitials, we must use the viewable impression event
        format !== googletag.enums.OutOfPageFormat.INTERSTITIAL.toString()
      ) {
        // for the google web interstitial, the slot id is not the same as the ad unit code
        // it can look like this 'gpt_unit_/33559401,22597236956/gutefrage/gf_interstitial/desktop/gutefrage.net_0'
        // To avoid this issue, we use the ad unit path instead of the slot id
        onSlotRenderEndedOrImpressionViewable(event.slot.getAdUnitPath());
      }
    },

    onImpressionViewable(event: googletag.events.IImpressionViewableEvent) {
      // check if the ad unit path is configured with a pacing:interval
      const [format] = event.slot.getTargeting(formatKey);
      if (format === googletag.enums.OutOfPageFormat.INTERSTITIAL.toString()) {
        // for the google web interstitial, the slot id is not the same as the ad unit code
        // it can look like this 'gpt_unit_/33559401,22597236956/gutefrage/gf_interstitial/desktop/gutefrage.net_0'
        // To avoid this issue, we use the ad unit path instead of the slot id
        onSlotRenderEndedOrImpressionViewable(event.slot.getAdUnitPath());
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
            // if there are no winning impressions yet, we can request ads
            positionLastImpressionNumberOfAdRequests.has(adUnitPath) &&
            // check if enough ad requests were made since the last impression
            numAdRequests - (positionLastImpressionNumberOfAdRequests.get(adUnitPath) ?? 0) <
              positionConfig.conditions.pacingRequestAds.requestAds) ||
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
