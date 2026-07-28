import { googletag } from 'ad-tag/types/googletag';

/**
 * Finds a live googletag slot by domId OR adUnitPath. The domId-only match works for in-page
 * slots and the `'out-of-page'` custom-format case, which pass moli's domId as the GPT element
 * id. Out-of-page slots (anchor/interstitial) never get that domId set by GPT, so adUnitPath is
 * required as a fallback.
 */
export const findGoogletagSlot = (
  reference: { domId?: string; adUnitPath?: string },
  googletag: googletag.IGoogleTag
): googletag.IAdSlot | undefined =>
  googletag
    .pubads()
    .getSlots()
    .find(slot => {
      const slotDomId = slot.getSlotElementId();
      const slotAdUnitPath = slot.getAdUnitPath();
      return (
        (!!reference.domId && !!slotDomId && slotDomId === reference.domId) ||
        (!!reference.adUnitPath && !!slotAdUnitPath && slotAdUnitPath === reference.adUnitPath)
      );
    });
