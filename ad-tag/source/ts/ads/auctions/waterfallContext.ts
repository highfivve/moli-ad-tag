import { googletag } from 'ad-tag/types/googletag';
import { AdUnitPathVariables, resolveAdUnitPath } from 'ad-tag/ads/adUnitPath';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { NowInstant } from 'ad-tag/ads/auctions/resume';

/**
 * Shared shape for a single-slot demand waterfall: an ordered list of channels, persisted to
 * session storage so the winning channel survives across page navigations within the same
 * session.
 */
export type WaterfallState<Channel extends string> = {
  priority: Channel[];

  /**
   * UTC timestamp in ms to track when the state was last updated.
   */
  updatedAt: number;
};

/**
 * Config for a single `createWaterfallContext` instance. Shaped like `auction.InterstitialConfig`
 * / `auction.AnchorConfig`.
 */
export interface WaterfallConfig<Channel extends string> {
  readonly adUnitPath: string;
  readonly domId: string;
  readonly priority: Channel[];
  readonly ttlStorage?: number;
}

/**
 * Decides whether a waterfall's priority should shift to the back after a given event.
 *
 * Different formats need different rotation policies:
 * - anchor formats only shift on an empty ad response / no bid (see ADR 0004)
 * - the interstitial format (not yet migrated onto this factory) additionally shifts on every
 *   successful GAM render, to work around a GAM-hardwired frequency cap
 */
export interface RotationTrigger<Channel extends string> {
  /**
   * @param event the slotRenderEnded event for this waterfall's ad unit
   */
  shouldShiftOnSlotRenderEnded(event: googletag.events.ISlotRenderEndedEvent): boolean;

  /**
   * @param event the auctionEnd event that included this waterfall's domId
   * @param domId the domId of this waterfall's ad slot
   */
  shouldShiftOnAuctionEnd(event: prebidjs.event.AuctionObject, domId: string): boolean;
}

/**
 * Rotation policy that only shifts priority when the current channel fails to deliver: an
 * empty ad response for `gam`, or no bid for `c`. The winning channel is kept as long as it
 * keeps delivering. See ADR 0004.
 */
export const createOnEmptyBidRotationTrigger = <
  Channel extends string
>(): RotationTrigger<Channel> => ({
  shouldShiftOnSlotRenderEnded: event => event.isEmpty,
  shouldShiftOnAuctionEnd: (event, domId) => {
    const bids = event.bidsReceived?.filter(bid => bid.adUnitCode === domId);
    return (bids?.length ?? 0) === 0;
  }
});

export interface WaterfallContext<Channel extends string> {
  /**
   * INTERNAL: for testing purposes only.
   */
  state(): WaterfallState<Channel>;

  /**
   * @return the channel that should currently be used to request this waterfall's ad, or
   *         undefined if no channel is configured.
   */
  channel(): Channel | undefined;

  /**
   * Ad unit paths can contain variables that need to be resolved at runtime. Call this once the
   * `adUnitPathVariables` are available, so the ad unit path can be matched against events.
   */
  updateAdUnitPaths(adUnitPathVariables: AdUnitPathVariables): void;

  onSlotRenderEnded(event: googletag.events.ISlotRenderEndedEvent): void;

  onAuctionEnd(event: prebidjs.event.AuctionObject): void;
}

/**
 * Generic single-slot demand waterfall: session-persisted priority list of channels, shifted to
 * the back on a rotation trigger's signal. See ADR 0005 for why this is a standalone factory
 * rather than a shared base for `interstitialContext.ts`.
 */
export const createWaterfallContext = <Channel extends string>(
  sessionStorageKey: string,
  config: WaterfallConfig<Channel>,
  rotationTrigger: RotationTrigger<Channel>,
  window__: Window & googletag.IGoogleTagWindow,
  now: NowInstant,
  logger: MoliRuntime.MoliLogger,
  logLabel: string
): WaterfallContext<Channel> => {
  const sessionStorageTimeToLive = config.ttlStorage ?? 30 * 60 * 1000; // 30 minutes
  const currentTime = now();
  let resolvedAdUnitPath = config.adUnitPath;
  let currentState: WaterfallState<Channel> = {
    priority: config.priority,
    updatedAt: currentTime
  };

  // Load any previous state from session storage.
  try {
    const sessionState = window__.sessionStorage.getItem(sessionStorageKey);
    if (sessionState) {
      const parsedState: WaterfallState<Channel> = JSON.parse(sessionState);
      // Check if the session state is still valid based on the TTL.
      if (currentTime - parsedState.updatedAt < sessionStorageTimeToLive) {
        currentState = parsedState;
      } else {
        currentState.updatedAt = currentTime;
      }
    }
  } catch (e) {
    logger.error(logLabel, 'failed to load waterfall state from session storage', e);
  }

  if (config.priority.length === 0) {
    logger.error(logLabel, 'no waterfall priority configured');
  }

  const persistState = (): void => {
    currentState.updatedAt = now();
    try {
      window__.sessionStorage.setItem(sessionStorageKey, JSON.stringify(currentState));
    } catch (e) {
      logger.error(logLabel, 'failed to persist waterfall state to session storage', e);
    }
  };

  const shiftPriority = (arr: Channel[]): Channel[] => {
    if (arr.length === 0) {
      return [];
    }
    return [...arr.slice(1), arr[0]];
  };

  const onSlotRenderEnded = (event: googletag.events.ISlotRenderEndedEvent): void => {
    if (event.slot.getAdUnitPath() !== resolvedAdUnitPath) {
      return;
    }
    if (rotationTrigger.shouldShiftOnSlotRenderEnded(event)) {
      currentState.priority = shiftPriority(currentState.priority);
      persistState();
    }
  };

  const onAuctionEnd = (event: prebidjs.event.AuctionObject): void => {
    if (!event.adUnitCodes.includes(config.domId)) {
      return;
    }
    if (rotationTrigger.shouldShiftOnAuctionEnd(event, config.domId)) {
      currentState.priority = shiftPriority(currentState.priority);
      persistState();
    }
  };

  return {
    state: (): WaterfallState<Channel> => currentState,
    channel: (): Channel | undefined => currentState.priority[0],
    updateAdUnitPaths: (variables: AdUnitPathVariables): void => {
      resolvedAdUnitPath = resolveAdUnitPath(config.adUnitPath, variables);
    },
    onSlotRenderEnded,
    onAuctionEnd
  };
};
