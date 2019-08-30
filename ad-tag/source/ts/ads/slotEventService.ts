import { Moli } from '../../../source/ts/types/moli';
import { googletag } from '../../../source/ts/types/googletag';

/**
 * # Slot EventSource
 *
 * An event source wraps a single eventListener and ensures that events aren't handled
 * multiple times.
 *
 * The current implementation provides only a single callback that can be changed.
 *
 */
export interface ISlotEventSource {

  /**
   * Set a callback that is called when the underlying event is fired.
   * This will override any previous callback.
   *
   * @param callback - called when the underlying event is fired
   */
  setCallback(callback: EventListenerOrEventListenerObject): void;
}

// internal datastructures to managed EventSources
type IEventSourceDictionary = {
  [key: string]: { eventSource: SlotEventSource, trigger: Moli.behaviour.EventTrigger } | undefined;
};

type IEventSources = {
  window: IEventSourceDictionary,
  document: IEventSourceDictionary,
  element: IEventSourceDictionary
};

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

  private eventSources: IEventSources = {
    window: {},
    document: {},
    element: {}
  };

  constructor(private readonly logger: Moli.MoliLogger) {
  }


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

  /**
   * Creates or returns an EventSource for the given trigger.
   *
   * @param trigger the underlying trigger of the EventSource
   * @param window global window object
   */
  public getOrCreateEventSource(trigger: Moli.behaviour.EventTrigger, window: Window): ISlotEventSource {
    const dictionary = this.getEventSourceDictionary(trigger, window);
    const eventSource = dictionary[trigger.event] || {
      eventSource: this.createEventSource(trigger, window),
      trigger: trigger
    };
    dictionary[trigger.event] = eventSource;
    return eventSource.eventSource;
  }

  /**
   * Remove a single event source so it doesn't trigger any events.
   * @param trigger
   * @param window
   */
  public removeEventSource(trigger: Moli.behaviour.EventTrigger, window: Window): void {
    this.logger.debug('SlotEventService', `remove EventSource configured by`, trigger);
    const source = trigger.source;
    const eventName = trigger.event;
    if (typeof source === 'string') {
      const eventSource = this.eventSources.element[eventName];
      const element = window.document.querySelector(source);
      if (eventSource && element) {
        element.removeEventListener(trigger.event, eventSource.eventSource);
      }
    } else if (source === window) {
      const eventSource = this.eventSources.window[eventName];
      if (eventSource) {
        window.removeEventListener(eventName, eventSource.eventSource);
      }
    } else {
      const eventSource = this.eventSources.document[eventName];
      if (eventSource) {
        window.document.removeEventListener(eventName, eventSource.eventSource);
      }
    }

  }

  /**
   * Removes all registered listeners on window, documenet and
   * @param window
   */
  public removeAllEventSources(window: Window): void {
    this.logger.debug('SlotEventService', `remove all EventSources`);
    Object.keys(this.eventSources.window).forEach(eventName => {
      const eventSource = this.eventSources.window[eventName];
      if (eventSource) {
        window.removeEventListener(eventName, eventSource.eventSource);
      }
    });

    Object.keys(this.eventSources.document).forEach(eventName => {
      const eventSource = this.eventSources.document[eventName];
      if (eventSource) {
        window.document.removeEventListener(eventName, eventSource.eventSource);
      }
    });

    Object.keys(this.eventSources.element).forEach(eventName => {
      const eventSource = this.eventSources.element[eventName];
      if (eventSource && typeof eventSource.trigger.source === 'string') {
        const element = window.document.querySelector(eventSource.trigger.source);
        if (element) {
          element.removeEventListener(eventName, eventSource.eventSource);
        }
      }
    });

    // empty
    this.eventSources = {
      window: {},
      document: {},
      element: {},
    };

  }

  private getEventSourceDictionary(trigger: Moli.behaviour.EventTrigger, window: Window): IEventSourceDictionary {
    const source = trigger.source;
    if (typeof source === 'string') {
      return this.eventSources.element;
    } else if (source === window) {
      return this.eventSources.window;
    } else {
      return this.eventSources.document;
    }
  }

  private createEventSource(trigger: Moli.behaviour.EventTrigger, window: Window): SlotEventSource {
    this.logger.debug('SlotEventService', `create EventSource for trigger`, trigger);
    const eventSource = new SlotEventSource();

    if (typeof trigger.source === 'string') {
      const element = window.document.querySelector(trigger.source);
      if (element) {
        element.addEventListener(trigger.event, eventSource, { passive: true });
      } else {
        throw new Error(`Invalid query selector for refresh listener trigger: ${trigger.source}`);
      }
    } else {
      trigger.source.addEventListener(trigger.event, eventSource, { passive: true });
    }

    return eventSource;
  }

}

/**
 * # Slot EventSource
 *
 * Acts as the mediation layer between DOM events and Moli services that
 * want to listen to those events.
 *
 */
class SlotEventSource implements ISlotEventSource, EventListenerObject {

  private currentCallback: EventListener;

  constructor() {
    // default to noop on registration
    this.currentCallback = (_: Event) => {
      return;
    };
  }

  public handleEvent(evt: Event): void {
    this.currentCallback(evt);
  }

  public setCallback(callback: EventListener): void {
    this.currentCallback = callback;
  }


}
