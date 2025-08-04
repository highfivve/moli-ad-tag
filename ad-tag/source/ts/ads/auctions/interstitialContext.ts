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
 * - 'pending-navigation': Interstitial has been requested and is waiting for a navigation event to display.
 *                         This is used for GAM Web Interstitials that are displayed on user navigation.
 *                         Or for custom implementations to wait for a user navigation and display the ad
 *                         on the next page.
 * - 'empty': Interstitial has been requested but no ad was returned.
 */
type InterstitialState = {
  /**
   * The current state of the interstitial ad format.
   */
  state: 'init' | 'not-requested' | 'requested' | 'bid' | 'no-bid' | 'rendered';

  /**
   * The channel that is currently being used to request the interstitial ad.
   */
  channel: auction.InterstitialChannel;

  /**
   * UTC timestamp in ms to track when the state was last updated.
   */
  updatedAt: number;
};

export interface InterstitialContext {
  /**
   *
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
  interstitialChannel(): auction.InterstitialChannel | null | undefined;

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
   * Persists the interstitial channel that is actually being requested.
   */
  onSlotRequested(event: googletag.events.ISlotRequestedEvent): void;

  /**
   * Check if an interstitial ad has been rendered through GAM.
   */
  onSlotRenderEnded(event: googletag.events.ISlotRenderEndedEvent): void;

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
  window: Window & googletag.IGoogleTagWindow,
  now: NowInstant,
  logger: MoliRuntime.MoliLogger
): InterstitialContext => {
  const sessionStorageKey = 'h5v_intstl';
  const sessionStorageTimeToLive = config.ttlStorage ?? 30 * 60 * 1000; // 30 minutes
  let interstitialAdUnitPath = config.adUnitPath;
  let currentInterstitialState: InterstitialState = {
    state: 'init',
    channel: config.priority[0] ?? 'gam',
    updatedAt: now()
  };

  // Load any previous interstitial state from session storage.
  try {
    const sessionState = window.sessionStorage.getItem(sessionStorageKey);
    if (sessionState) {
      const parsedState: InterstitialState = JSON.parse(sessionState);

      // Check if the session state is still valid based on the TTL.
      if (now() - parsedState.updatedAt < sessionStorageTimeToLive) {
        currentInterstitialState = parsedState;
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

  const hasState = (
    channel: auction.InterstitialChannel,
    state: InterstitialState['state']
  ): boolean => {
    return currentInterstitialState.channel === channel && currentInterstitialState.state === state;
  };

  const onSlotRequested = (event: googletag.events.ISlotRequestedEvent): void => {
    // early return if the slot is not the interstitial ad unit
    if (event.slot.getAdUnitPath() !== interstitialAdUnitPath) {
      return;
    }

    currentInterstitialState.state = 'requested';
    currentInterstitialState.channel = isGamInterstitial(event.slot, window) ? 'gam' : 'c';
    persistInterstitialState();
  };

  const onSlotRenderEnded = (event: googletag.events.ISlotRenderEndedEvent): void => {
    // early return if the slot is not the interstitial ad unit
    if (event.slot.getAdUnitPath() !== interstitialAdUnitPath) {
      return;
    }

    if (event.isEmpty) {
      currentInterstitialState.state = 'no-bid';
    } else {
      // GAM interstitials are rendered on user navigation, so we set the state to 'bid'. It will
      // be updated to 'rendered' once the impression viewable event is fired.
      currentInterstitialState.state = isGamInterstitial(event.slot, window) ? 'bid' : 'rendered';
    }
    persistInterstitialState();
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
    const hasBids = (interstitialBids?.length ?? 0) > 0;
    currentInterstitialState.channel = 'c'; // custom interstitial channel
    currentInterstitialState.state = hasBids ? 'bid' : 'no-bid';
    persistInterstitialState();
  };

  /**
   * This method is called in the requestAds() methods, before ads are actually requested.
   * It translates to a new page view, so to say.
   */
  const beforeRequestAds = (): void => {
    if (
      // requestAds has been called for the first time
      currentInterstitialState.state === 'init' ||
      // we had prebid demand on the previous page, so we keep the channel
      hasState('c', 'bid') ||
      hasState('c', 'rendered')
    ) {
      currentInterstitialState.state = 'not-requested';
    } else {
      // rotate to the next channel in the priority list.
      // - prebid is handled above.
      // - the GAM interstitial has a hard frequency cap, so we try only once per session
      const channelIndex = config.priority.indexOf(currentInterstitialState.channel);
      const nextChannelIndex = (channelIndex + 1) % config.priority.length;
      currentInterstitialState.state = 'not-requested';
      currentInterstitialState.channel = config.priority[nextChannelIndex] ?? 'gam'; // fallback to 'gam' if no channel is configured
      persistInterstitialState();
    }
  };

  /**
   * Determines which interstitial channel should be used to request the interstitial ad.
   */
  const interstitialChannel = (): auction.InterstitialChannel | null | undefined => {
    return config.priority.find(channel => {
      // determine if the channel is allowed
      switch (channel) {
        case 'gam':
          return (
            // priority: ['gam', 'c'] or ['gam']
            // gam has first priority and has not yet been requested
            hasState('gam', 'not-requested') ||
            // priority: ['c', 'gam']
            // if gam has second priority and the custom interstitial has no demand
            hasState('c', 'no-bid')
          );

        case 'c':
          return (
            // priority: ['c', 'gam'] or ['c']
            // custom interstitial has first priority and has not yet been requested
            hasState('c', 'not-requested') ||
            // priority: ['gam', 'c']
            // if custom interstitial has second priority and the gam interstitial has no demand
            hasState('gam', 'no-bid')
          );
        default:
          return false;
      }
    });
  };

  return {
    interstitialChannel,
    onSlotRequested,
    onSlotRenderEnded,
    onAuctionEnd,
    beforeRequestAds,
    interstitialState: (): InterstitialState => {
      return currentInterstitialState;
    },
    updateAdUnitPaths: (variables: AdUnitPathVariables): void => {
      interstitialAdUnitPath = resolveAdUnitPath(config.adUnitPath, variables);
    }
  };
};
