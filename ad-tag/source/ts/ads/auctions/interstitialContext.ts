import { googletag } from 'ad-tag/types/googletag';
import { AdUnitPathVariables, resolveAdUnitPath } from 'ad-tag/ads/adUnitPath';
import { auction } from 'ad-tag/types/moliConfig';
import { formatKey } from 'ad-tag/ads/keyValues';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { NowInstant } from 'ad-tag/ads/auctions/resume';

/**
 * Represents the current state of the interstitial ad format.
 *
 * - 'init': Fresh user session and the internal state is created for the first time.
 *           No session storage data is available. No previous state.
 * - 'not-requested': Interstitial ad has not been requested yet. Neither through GAM nor through HB.
 * - 'gam': Interstitial has been rendered through GAM Web Interstitial.
 * - 'c': Interstitial has been rendered through a custom implementation, e.g. header bidding.
 * - 'empty': Interstitial has been requested but no ad was returned.
 */
type InterstitialState = {
  priority: auction.InterstitialChannel[];

  /**
   * UTC timestamp in ms to track when the state was last updated.
   */
  updatedAt: number;
};

export interface InterstitialContext {
  /**
   * INTERNAL: for testing purposes only.
   */
  interstitialState(): InterstitialState;

  /**
   * This is the main logic to determine what interstitial ad format is allowed to be requested
   * and if yes, which channel should be used to request it.
   *
   * Different channels behave differently. GAM Web Interstitials are displayed on certain triggers,
   * like user navigation or visibility change of the site. Header Bidding interstitials are displayed
   * immediately after the auction is completed. The logic for header bidding interstitials lies in the
   * control of the ad tag itself.
   *
   * @return the channel that should be used to request the interstitial ad, or null if no channel is allowed.
   */
  interstitialChannel(): auction.InterstitialChannel | undefined;

  /**
   * Ad unit paths can contain variables that need to be resolved at runtime.
   * The global auction context and hence the frequency capping is initialized early on.
   * Once the `adUnitPathVariables` are available, this method should be called, so ad unit paths
   * can be resolved from the config and matched against the ad unit paths in the auction.
   *
   * @param adUnitPathVariables
   */
  updateAdUnitPaths(adUnitPathVariables: AdUnitPathVariables): void;

  /**
   * Check if an interstitial ad has been rendered through GAM.
   */
  onSlotRenderEnded(event: googletag.events.ISlotRenderEndedEvent): void;

  /**
   * Required for google web interstitials to capture if an impression was actually rendered.
   * The rendered event fires even if the ad was not rendered.
   */
  onImpressionViewable(event: googletag.events.IImpressionViewableEvent): void;

  /**
   * Required to check if there are bids for the interstitial ad format.
   *
   * If the custom interstitial has a higher priority than the GAM interstitial, the auction end
   * event is necessary to determine if a switch to the GAM interstitial should be made.
   */
  onAuctionEnd(event: prebidjs.event.AuctionObject): void;

  /**
   * Reset the interstitial state.
   */
  beforeRequestAds(): void;
}

export const isGamInterstitial = (
  slot: googletag.IAdSlot,
  window: googletag.IGoogleTagWindow
): boolean => {
  const [value] = slot.getTargeting(formatKey);
  return !!value && value === window.googletag.enums.OutOfPageFormat.INTERSTITIAL.toString();
};

export const createInterstitialContext = (
  config: auction.InterstitialConfig,
  window__: Window & googletag.IGoogleTagWindow,
  now: NowInstant,
  logger: MoliRuntime.MoliLogger
): InterstitialContext => {
  const sessionStorageKey = 'h5v_intstl';
  const sessionStorageTimeToLive = config.ttlStorage ?? 30 * 60 * 1000; // 30 minutes
  const currentTime = now();
  let interstitialAdUnitPath = config.adUnitPath;
  let currentInterstitialState: InterstitialState = {
    priority: config.priority,
    updatedAt: currentTime
  };

  // Load any previous interstitial state from session storage.
  try {
    const sessionState = window__.sessionStorage.getItem(sessionStorageKey);
    if (sessionState) {
      const parsedState: InterstitialState = JSON.parse(sessionState);
      // Check if the session state is still valid based on the TTL.
      if (currentTime - parsedState.updatedAt < sessionStorageTimeToLive) {
        currentInterstitialState = parsedState;
      } else {
        currentInterstitialState.updatedAt = currentTime;
      }
    }
  } catch (e) {
    logger.error('interstitial', 'failed to load interstitial state from session storage', e);
  }

  if (config.priority.length === 0) {
    logger.error('interstitial', 'no interstitial priority configured');
  }

  const persistInterstitialState = (): void => {
    currentInterstitialState.updatedAt = now();
    try {
      window.sessionStorage.setItem(sessionStorageKey, JSON.stringify(currentInterstitialState));
    } catch (e) {
      logger.error('interstitial', 'failed to persist interstitial state to session storage', e);
    }
  };

  const shiftDemandPriority = (
    arr: auction.InterstitialChannel[]
  ): auction.InterstitialChannel[] => {
    if (arr.length === 0) {
      return [];
    }
    return [...arr.slice(1), arr[0]];
  };

  const onSlotRenderEnded = (event: googletag.events.ISlotRenderEndedEvent): void => {
    // early return if the slot is not the interstitial ad unit
    if (event.slot.getAdUnitPath() !== interstitialAdUnitPath) {
      return;
    }

    // if there's no demand, shift the demand priority
    if (event.isEmpty) {
      currentInterstitialState.priority = shiftDemandPriority(currentInterstitialState.priority);
      persistInterstitialState();
    }
  };

  const onImpressionViewable = (event: googletag.events.IImpressionViewableEvent): void => {
    // early return if the slot is not the interstitial ad unit
    if (event.slot.getAdUnitPath() !== interstitialAdUnitPath) {
      return;
    }

    // if GAM interstitial was rendered, we choose the next demand priority
    if (isGamInterstitial(event.slot, window__)) {
      currentInterstitialState.priority = shiftDemandPriority(currentInterstitialState.priority);
      persistInterstitialState();
    }
  };

  // check if there is demand from a prebid auction
  const onAuctionEnd = (event: prebidjs.event.AuctionObject): void => {
    // early return if the interstitial ad unit is not part of the auction
    if (!event.adUnitCodes.includes(config.domId)) {
      return;
    }
    // for now, we only check if a bid is available. This can be more sophisticated in the future
    // to check for a certain bid CPM. However, prebid.js floor price feature should already filter
    // out all bids below a certain CPM
    const interstitialBids = event.bidsReceived?.filter(bid => bid.adUnitCode === config.domId);
    if ((interstitialBids?.length ?? 0) === 0) {
      // if there are no bids, we shift the demand priority
      currentInterstitialState.priority = shiftDemandPriority(currentInterstitialState.priority);
      persistInterstitialState();
    }
  };

  /**
   * Determines which interstitial channel should be used to request the interstitial ad.
   */
  const interstitialChannel = (): auction.InterstitialChannel | undefined => {
    return currentInterstitialState.priority[0];
  };

  return {
    interstitialChannel,
    onSlotRenderEnded,
    onImpressionViewable,
    onAuctionEnd,
    beforeRequestAds: (): void => {
      // TODO
    },
    interstitialState: (): InterstitialState => {
      return currentInterstitialState;
    },
    updateAdUnitPaths: (variables: AdUnitPathVariables): void => {
      interstitialAdUnitPath = resolveAdUnitPath(config.adUnitPath, variables);
    }
  };
};
