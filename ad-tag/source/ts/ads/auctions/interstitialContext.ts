import { NowInstant } from './resume';
import { googletag } from '../../types/googletag';
import { Moli } from '../../types/moli';
import auction = Moli.auction;
import MoliLogger = Moli.MoliLogger;
import { formatKey } from '../keyValues';
import { prebidjs } from '../../types/prebidjs';
import { AdUnitPathVariables, resolveAdUnitPath } from '../adUnitPath';

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
}

export const isGamInterstitial = (
  slot: googletag.IAdSlot,
  window: googletag.IGoogleTagWindow
): boolean => {
  const [value] = slot.getTargeting(formatKey);
  return !!value && value === window.googletag.enums.OutOfPageFormat.INTERSTITIAL.toString();
};

export class InterstitialContextImpl implements InterstitialContext {
  private sessionStorageKey: string;
  private sessionStorageTimeToLive: number;
  private interstitialAdUnitPath: string;
  private currentInterstitialState: InterstitialState;

  private name = 'InterstitialContext';

  constructor(
    private readonly config: auction.InterstitialConfig,
    private readonly window__: Window & googletag.IGoogleTagWindow,
    private readonly now: NowInstant,
    private readonly logger: MoliLogger
  ) {
    this.config = config;
    this.window__ = window__;
    this.now = now;
    this.logger = logger;
    this.sessionStorageKey = 'h5v_intstl';
    this.sessionStorageTimeToLive = config.ttlStorage ?? 30 * 60 * 1000; // 30 minutes
    this.interstitialAdUnitPath = config.adUnitPath;
    const currentTime = now();
    this.currentInterstitialState = {
      priority: config.priority,
      updatedAt: currentTime
    };
    try {
      const sessionState = window__.sessionStorage.getItem(this.sessionStorageKey);
      if (sessionState) {
        const parsedState: InterstitialState = JSON.parse(sessionState);
        if (currentTime - parsedState.updatedAt < this.sessionStorageTimeToLive) {
          this.currentInterstitialState = parsedState;
        } else {
          this.currentInterstitialState.updatedAt = currentTime;
        }
      }
    } catch (e) {
      logger.error('interstitial', 'failed to load interstitial state from session storage', e);
    }
    if (config.priority.length === 0) {
      logger.error('interstitial', 'no interstitial priority configured');
    }
  }

  private persistInterstitialState(): void {
    this.currentInterstitialState.updatedAt = this.now();
    try {
      this.window__.sessionStorage.setItem(
        this.sessionStorageKey,
        JSON.stringify(this.currentInterstitialState)
      );
    } catch (e) {
      this.logger.error(
        'interstitial',
        'failed to persist interstitial state to session storage',
        e
      );
    }
  }

  private shiftDemandPriority(arr: auction.InterstitialChannel[]): auction.InterstitialChannel[] {
    if (arr.length === 0) {
      return [];
    }
    const updatedPriority = [...arr.slice(1), arr[0]];
    this.logger.debug(this.name, 'shift interstitial priority', updatedPriority);
    return updatedPriority;
  }

  interstitialState(): InterstitialState {
    return this.currentInterstitialState;
  }

  interstitialChannel(): auction.InterstitialChannel | undefined {
    return this.currentInterstitialState.priority[0];
  }

  updateAdUnitPaths(variables: AdUnitPathVariables): void {
    this.interstitialAdUnitPath = resolveAdUnitPath(this.config.adUnitPath, variables);
  }

  onSlotRenderEnded(event: googletag.events.ISlotRenderEndedEvent): void {
    if (event.slot.getAdUnitPath() !== this.interstitialAdUnitPath) {
      return;
    }
    if (event.isEmpty) {
      this.currentInterstitialState.priority = this.shiftDemandPriority(
        this.currentInterstitialState.priority
      );
      this.persistInterstitialState();
    }
  }

  onImpressionViewable(event: googletag.events.IImpressionViewableEvent): void {
    if (event.slot.getAdUnitPath() !== this.interstitialAdUnitPath) {
      return;
    }
    if (isGamInterstitial(event.slot, this.window__)) {
      this.currentInterstitialState.priority = this.shiftDemandPriority(
        this.currentInterstitialState.priority
      );
      this.persistInterstitialState();
    }
  }

  onAuctionEnd(event: prebidjs.event.AuctionObject): void {
    if (!event.adUnitCodes.includes(this.config.domId)) {
      return;
    }
    const interstitialBids = event.bidsReceived?.filter(
      bid => bid.adUnitCode === this.config.domId
    );
    if ((interstitialBids?.length ?? 0) === 0) {
      this.currentInterstitialState.priority = this.shiftDemandPriority(
        this.currentInterstitialState.priority
      );
      this.persistInterstitialState();
    }
  }
}
