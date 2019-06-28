import { Moli } from '../../../source/ts/types/moli';
import { googletag } from '../../../source/ts/types/googletag';

/**
 * # Slot Event Service
 *
 * This services wraps events from googletag (and probably prebidjs as well in the future).
 * We do this to
 *
 * - provide common use cases that are use in different places (e.g. all ads are rendered)
 * - add additional features (e.g. remove listeners to avoid memory leaks)
 *
 */
export class SlotEventService {

  /**
   * Internal data structure to add callbacks for the SlotRenderEndedEvent. We require this
   * so we can remove callbacks that are finished (Promise resolved) and don't create a memory
   * leak for single page applications. This would not be necessary if the gpt tag would have
   * the ability to remove listeners.
   */
  private readonly slotRenderEndedEventCallbacks: Set<(event: googletag.events.ISlotRenderEndedEvent) => void> = new Set();

  /**
   * Initialize the service once the gpt tag is loaded.
   *
   * @param googletag the available googletag
   * @param env
   */
  public initialize(googletag: googletag.IGoogleTag, env: Moli.Environment): void {
    switch (env) {
      case 'production':
        // Initialize the listener only once and manage the callbacks internally
        googletag.pubads().addEventListener('slotRenderEnded', event => {
          this.slotRenderEndedEventCallbacks.forEach(callback => callback(event));
        });
        break;
      case 'test':
        // do nothing
        break;
    }
  }

  /**
   * Returns a promise which resolves when all ad slots have been rendered.
   *
   * @param adSlots the ad slots that need to be rendered to resolve the Promise
   * @return {Promise<googletag.events.ISlotRenderEndedEvent[]>}
   */
  public awaitAllAdSlotsRendered(adSlots: Moli.AdSlot[]): Promise<googletag.events.ISlotRenderEndedEvent[]> {

    return new Promise<googletag.events.ISlotRenderEndedEvent[]>(resolve => {
      const unrenderedSlots = new Set(adSlots.map(slot => slot.adUnitPath));
      const renderEvents: googletag.events.ISlotRenderEndedEvent[] = [];

      const callback = (event: googletag.events.ISlotRenderEndedEvent) => {
        unrenderedSlots.delete(event.slot.getAdUnitPath());
        renderEvents.push(event);
        if (unrenderedSlots.size === 0) {
          resolve(renderEvents);
          // remove the callback as the promise is resolved
          this.slotRenderEndedEventCallbacks.delete(callback);
        }
      };

      this.slotRenderEndedEventCallbacks.add(callback);
    });
  }

}
