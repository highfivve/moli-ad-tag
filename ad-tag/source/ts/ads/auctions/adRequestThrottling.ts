import { googletag } from '../../types/googletag';

/**
 * TODO move this into moli modules namespace
 */
export interface AdRequestThrottlingConfig {
  /**
   * the time in seconds that has to pass before a slot can be requested again
   */
  throttle: number;
}

export class AdRequestThrottling {
  /**
   * stores the information if a slot was requested and should not be requested again
   * @private
   */
  private slotsRequested: Set<string> = new Set();

  constructor(
    private readonly config: AdRequestThrottlingConfig,
    private readonly _window: Window
  ) {}

  onSlotRequested(event: googletag.events.ISlotRequestedEvent) {
    // store information about the request
    this.slotsRequested.add(event.slot.getSlotElementId());
    this._window.setTimeout(() => {
      this.slotsRequested.delete(event.slot.getSlotElementId());
    }, this.config.throttle * 1000);
  }

  isThrottled(slotId: string): boolean {
    return this.slotsRequested.has(slotId);
  }
}
