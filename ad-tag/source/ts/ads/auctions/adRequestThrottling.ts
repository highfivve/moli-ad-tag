import { googletag } from '../../types/googletag';
import { auction } from '../../types/moliConfig';

export interface AdRequestThrottling {
  onSlotRequested(event: googletag.events.ISlotRequestedEvent): void;
  isThrottled(slotId: string): boolean;
}

export const createAdRequestThrottling = (
  config: auction.AdRequestThrottlingConfig,
  _window: Window
): AdRequestThrottling => {
  const slotsRequested: Set<string> = new Set();

  function onSlotRequested(event: googletag.events.ISlotRequestedEvent): void {
    const slotId = event.slot.getSlotElementId();
    const shouldAddSlot =
      !config.includedDomIds ||
      config.includedDomIds.length === 0 ||
      config.includedDomIds.includes(slotId);

    if (shouldAddSlot) {
      slotsRequested.add(slotId);
      _window.setTimeout(() => {
        slotsRequested.delete(slotId);
      }, config.throttle * 1000);
    }
  }

  function isThrottled(slotId: string): boolean {
    return slotsRequested.has(slotId);
  }

  return {
    onSlotRequested,
    isThrottled
  };
};
