/**
 * The `f` stands for "format" in the context of an ad slot.
 * Values are used to specify the format of the ad being requested. Currently, we use the
 * googletag enum `OutOfPageFormat` and extend it with custom format values.
 *
 * Standard Google formats:
 * - '2' = TOP_ANCHOR
 * - '3' = BOTTOM_ANCHOR
 * - '4' = REWARDED
 * - '5' = INTERSTITIAL (GAM Web Interstitial)
 *
 * Custom format extensions:
 * - '100' = Custom interstitial (header bidding or custom implementations)
 * - '101' = Custom bottom anchor (header bidding or custom implementations)
 * - '102' = Custom top anchor (header bidding or custom implementations)
 *
 * Main use case is to have the initially requested ad format available in googletag.pubads event
 * listeners, such as `slotRequested` and `slotRenderEnded`. This makes it possible to attach
 * additional behaviour to specific ad formats, such as interstitials.
 */
export const formatKey = 'f' as const;

/**
 * Custom format value for custom interstitials (header bidding or custom implementations)
 */
export const CUSTOM_INTERSTITIAL_FORMAT = '100' as const;

/**
 * Custom format value for the `c` channel of the bottom anchor waterfall (header bidding or
 * custom implementations). Shared across mobile and desktop bottom anchor instances, since
 * `domId` already differentiates those.
 */
export const CUSTOM_ANCHOR_BOTTOM_FORMAT = '101' as const;

/**
 * Custom format value for the `c` channel of the top anchor waterfall (header bidding or
 * custom implementations).
 */
export const CUSTOM_ANCHOR_TOP_FORMAT = '102' as const;
