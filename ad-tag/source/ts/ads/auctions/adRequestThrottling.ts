import { googletag } from '../../types/googletag';
import { Moli } from '../../types/moli';
import auction = Moli.auction;

export class AdRequestThrottling {
  /**
   * stores the information if a slot was requested and should not be requested again
   * @private
   */
  private slotsRequested: Set<string> = new Set();

  constructor(
    private readonly config: auction.AdRequestThrottlingConfig,
    private readonly _window: Window
  ) {}

  onSlotRequested(event: googletag.events.ISlotRequestedEvent) {
    const slotId = event.slot.getSlotElementId();
    // slot info should only be added if there's no list of included dom ids or the list includes the current slot id
    const shouldAddSlot =
      !this.config.includedDomIds ||
      this.config.includedDomIds.length === 0 ||
      this.config.includedDomIds.includes(slotId);

    if (shouldAddSlot) {
      this.slotsRequested.add(slotId);
      this._window.setTimeout(() => {
        this.slotsRequested.delete(slotId);
      }, this.config.throttle * 1000);
    }
  }

  isThrottled(slotId: string): boolean {
    return this.slotsRequested.has(slotId);
  }
}
