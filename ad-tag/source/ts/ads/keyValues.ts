/**
 * The `f` stands for "format" in the context of an ad slot.
 * Values are used to specify the format of the ad being requested. Currently, we use the
 * googletag enum `OutOfPageFormat`.
 *
 * Main use case is to have the initially requested ad format available in googletag.pubads event
 * listeners, such as `slotRequested` and `slotRenderEnded`. This makes it possible to attach
 * additional behaviour to specific ad formats, such as interstitials.
 */
export const formatKey = 'f' as const;
