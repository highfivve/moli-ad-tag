import { prebidjs } from '../../types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { auction } from '../../types/moliConfig';
import { NowInstant, remainingTime, ResumeCallbackData } from './resume';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { AdUnitPathVariables, resolveAdUnitPath } from '../adUnitPath';
import { googletag } from 'ad-tag/types/googletag';
import { formatKey } from 'ad-tag/ads/keyValues';
import { isGamInterstitial } from 'ad-tag/ads/auctions/interstitialContext';

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
   * The number of ad request when the last impression was one for this ad unit path
   * This is used to check if the number of ad requests is sufficient for the next ad request
   */
  readonly pLastImpAdRequests: { [adUnitPath: string]: number | undefined };

  /**
   * number of requestAds made so far
   */
  readonly requestAds: number;
};

export interface FrequencyCapping {
  onAuctionEnd(auction: prebidjs.event.AuctionObject): void;
  onBidWon(bid: prebidjs.BidResponse): void;
  onSlotRequested(event: googletag.events.ISlotRequestedEvent): void;
  onSlotRenderEnded(event: googletag.events.ISlotRenderEndedEvent): void;
  onImpressionViewable(event: googletag.events.IImpressionViewableEvent): void;
  afterRequestAds(): void;
  beforeRequestAds(): void;
  updateAdUnitPaths(adUnitPathVariables: AdUnitPathVariables): void;

  /**
   * Check if an ad unit path is capped.
   *
   * @param slot the ad slot to check
   */
  isAdUnitCapped(slot: googletag.IAdSlot): boolean;

  /**
   * Check if a bidder is capped for a given slot id.
   *
   * @param slotId the DOM ID of the ad slot
   * @param bidder a prebid bidder code
   */
  isBidderCapped(slotId: string, bidder: BidderCode): boolean;

  /**
   * Get the current number of requestAds calls
   */
  getRequestAdsCount(): number;
}

const hasPacingInterval = (
  config: auction.BidderFrequencyCappingConfig
): config is BidderFrequencyCappingConfigWithPacingInterval =>
  !!config.conditions && !!config.conditions.pacingInterval;

export const createFrequencyCapping = (
  config: auction.FrequencyCappingConfig,
  _window: Window & googletag.IGoogleTagWindow,
  now: NowInstant,
  logger: MoliRuntime.MoliLogger
): FrequencyCapping => {
  const positionImpSchedules: Map<string, FrequencyCappingPositionImpSchedules> = new Map();
  const positionLastImpressionNumberOfAdRequests: Map<string, number> = new Map();
  const bidderImpSchedules: Map<string, FrequencyCappingBidderImpSchedules> = new Map();
  const positionAdRequests: Map<string, number> = new Map();
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
        pLastImpAdRequests: Array.from(positionLastImpressionNumberOfAdRequests.entries()).reduce<
          PersistedFrequencyCappingState['pLastImpAdRequests']
        >((acc, [adUnitPath, numAdRequests]) => ({ ...acc, [adUnitPath]: numAdRequests }), {}),
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

  const onSlotRenderEndedOrImpressionViewable = (adUnitPath: string) => {
    // check if the ad unit path is configured with a pacing:interval
    resolvedAdUnitPathPositionConfigs
      .filter(config => config.adUnitPath === adUnitPath)
      .forEach(config => {
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
    onSlotRequested(event: googletag.events.ISlotRequestedEvent) {
      // check if the ad unit path is configured with a requestAds limit
      resolvedAdUnitPathPositionConfigs
        .filter(config => config.adUnitPath === event.slot.getAdUnitPath())
        .forEach(config => {
          if (config.conditions.adRequestLimit) {
            // store the number of ad requests for this position
            const adUnitPath = config.adUnitPath;
            const currentAdRequests = positionAdRequests.get(adUnitPath) ?? 0;
            positionAdRequests.set(adUnitPath, currentAdRequests + 1);
          }
        });
    },
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

    beforeRequestAds() {
      positionAdRequests.clear();
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

    isAdUnitCapped(slot: googletag.IAdSlot): boolean {
      const adUnitPath = slot.getAdUnitPath();
      const isGamInst = isGamInterstitial(slot, _window);
      return resolvedAdUnitPathPositionConfigs
        .filter(config => config.adUnitPath === adUnitPath)
        .some(positionConfig => {
          return (
            (positionConfig.adUnitPath === adUnitPath &&
              // cap if minRequestAds is not reached yet. Note: for GAM interstitials are requested
              // one request ads cycle earlier, because they are actually rendered on navigation and
              // not immediately after the ad request.
              positionConfig.conditions.delay &&
              numAdRequests <
                positionConfig.conditions.delay.minRequestAds - (isGamInst ? 1 : 0)) ||
            // cap if not at the right pacing interval yet
            (positionConfig.conditions.pacingRequestAds &&
              // if there are no winning impressions yet, we can request ads
              positionLastImpressionNumberOfAdRequests.has(adUnitPath) &&
              // check if enough ad requests were made since the last impressionØp
              numAdRequests - (positionLastImpressionNumberOfAdRequests.get(adUnitPath) ?? 0) <
                positionConfig.conditions.pacingRequestAds.requestAds) ||
            // cap if the maxImpressions is reached in the current window
            (positionConfig.conditions.pacingInterval &&
              (positionImpSchedules.get(adUnitPath) ?? []).length >=
                positionConfig.conditions.pacingInterval.maxImpressions) ||
            // cap if the ad unit path has an ad request limit
            (positionConfig.conditions.adRequestLimit &&
              (positionAdRequests.get(adUnitPath) ?? 0) >=
                positionConfig.conditions.adRequestLimit.maxAdRequests)
          );
        });
    },

    isBidderCapped(slotId: string, bidder: BidderCode): boolean {
      if (!config.bidders) {
        return false;
      }
      return config.bidders
        .filter(c => c.domId === slotId && (!c.bidders || c.bidders.includes(bidder)))
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
    },

    getRequestAdsCount(): number {
      return numAdRequests;
    }
  };
};
