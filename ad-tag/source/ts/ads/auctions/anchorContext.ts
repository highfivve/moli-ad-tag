import { googletag } from 'ad-tag/types/googletag';
import { AdUnitPathVariables } from 'ad-tag/ads/adUnitPath';
import { auction } from 'ad-tag/types/moliConfig';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { NowInstant } from 'ad-tag/ads/auctions/resume';
import { formatKey } from 'ad-tag/ads/keyValues';
import {
  createWaterfallContext,
  createOnEmptyBidRotationTrigger,
  WaterfallContext
} from 'ad-tag/ads/auctions/waterfallContext';

/**
 * Check if a slot has been rendered as a GAM top/bottom anchor - i.e. the `gam` channel was
 * chosen for it. Mirrors `isGamInterstitial` in `interstitialContext.ts`.
 */
export const isGamAnchor = (
  slot: googletag.IAdSlot,
  window: googletag.IGoogleTagWindow
): boolean => {
  const [value] = slot.getTargeting(formatKey);
  return (
    !!value &&
    (value === window.googletag.enums.OutOfPageFormat.BOTTOM_ANCHOR.toString() ||
      value === window.googletag.enums.OutOfPageFormat.TOP_ANCHOR.toString())
  );
};

export interface AnchorContextConfigs {
  readonly bottomMobile?: auction.AnchorConfig;
  readonly bottomDesktop?: auction.AnchorConfig;
  readonly top?: auction.AnchorConfig;
}

export interface AnchorContext {
  /**
   * @param domId the domId of the bottom anchor slot (`mobile_stickyad` or `floorad`), used to
   *        disambiguate which of the two independent bottom instances to read from.
   */
  anchorBottomChannel(domId: string): auction.AnchorChannel | undefined;

  anchorTopChannel(): auction.AnchorChannel | undefined;

  updateAdUnitPaths(adUnitPathVariables: AdUnitPathVariables): void;

  onSlotRenderEnded(event: googletag.events.ISlotRenderEndedEvent): void;

  onAuctionEnd(event: prebidjs.event.AuctionObject): void;
}

const sessionStorageKeys = {
  bottomMobile: 'h5v_anchor_bm',
  bottomDesktop: 'h5v_anchor_bd',
  top: 'h5v_anchor_t'
} as const;

/**
 * Wires up the three independent anchor waterfall instances (bottom-mobile, bottom-desktop,
 * top) on top of `createWaterfallContext`, using the fail-only rotation policy (ADR 0004).
 */
export const createAnchorContext = (
  configs: AnchorContextConfigs,
  window__: Window & googletag.IGoogleTagWindow,
  now: NowInstant,
  logger: MoliRuntime.MoliLogger
): AnchorContext => {
  const bottomMobile = configs.bottomMobile
    ? createWaterfallContext(
        sessionStorageKeys.bottomMobile,
        configs.bottomMobile,
        createOnEmptyBidRotationTrigger<auction.AnchorChannel>(),
        window__,
        now,
        logger,
        'anchor-bottom-mobile'
      )
    : undefined;

  const bottomDesktop = configs.bottomDesktop
    ? createWaterfallContext(
        sessionStorageKeys.bottomDesktop,
        configs.bottomDesktop,
        createOnEmptyBidRotationTrigger<auction.AnchorChannel>(),
        window__,
        now,
        logger,
        'anchor-bottom-desktop'
      )
    : undefined;

  const top = configs.top
    ? createWaterfallContext(
        sessionStorageKeys.top,
        configs.top,
        createOnEmptyBidRotationTrigger<auction.AnchorChannel>(),
        window__,
        now,
        logger,
        'anchor-top'
      )
    : undefined;

  const bottomInstances = [bottomMobile, bottomDesktop].filter(
    (instance): instance is WaterfallContext<auction.AnchorChannel> => !!instance
  );

  const bottomInstanceForDomId = (
    domId: string
  ): WaterfallContext<auction.AnchorChannel> | undefined => {
    if (configs.bottomMobile?.domId === domId) {
      return bottomMobile;
    }
    if (configs.bottomDesktop?.domId === domId) {
      return bottomDesktop;
    }
    return undefined;
  };

  return {
    anchorBottomChannel: (domId: string): auction.AnchorChannel | undefined =>
      bottomInstanceForDomId(domId)?.channel(),
    anchorTopChannel: (): auction.AnchorChannel | undefined => top?.channel(),
    updateAdUnitPaths: (variables: AdUnitPathVariables): void => {
      bottomInstances.forEach(instance => instance.updateAdUnitPaths(variables));
      top?.updateAdUnitPaths(variables);
    },
    onSlotRenderEnded: (event: googletag.events.ISlotRenderEndedEvent): void => {
      bottomInstances.forEach(instance => instance.onSlotRenderEnded(event));
      top?.onSlotRenderEnded(event);
    },
    onAuctionEnd: (event: prebidjs.event.AuctionObject): void => {
      bottomInstances.forEach(instance => instance.onAuctionEnd(event));
      top?.onAuctionEnd(event);
    }
  };
};
