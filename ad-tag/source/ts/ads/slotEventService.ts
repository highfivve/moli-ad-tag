/**
 * @module
 * @internal
 */
import { Moli } from '../types/moli';
import { googletag } from '../types/googletag';
import { AdPipelineContext, ConfigureStep, mkConfigureStep } from './adPipeline';

export const slotEventServiceConfigure = (slotService: SlotEventService): ConfigureStep => {
  let result: Promise<void>;
  return mkConfigureStep('slot-event-service-configure', (ctx: AdPipelineContext) => {
    if (!result) {
      result = new Promise<void>(resolve => {
        slotService.initialize(ctx.window.googletag, ctx.env);
        resolve();
      });
    }
    return result;
  });
};

/**
 * # CallbackConfig for slot event sources
 *
 * Configures the callback handling:
 * - callback: called when the underlying event is fired
 * - permanent: if the callback should stay active after the event was fired once
 */
type CallbackConfig = {
  callback: EventListener;
  permanent: boolean;
};

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
   * Add a callback that is called when the underlying event is fired.
   * Only callbacks marked as permanent will be preserved after the first event.
   *
   * @param callbackObj configures the callback handling.
   * - callback: called when the underlying event is fired
   * - permanent: if the callback should stay active after the event was fired once
   */
  addCallback(callbackObj: CallbackConfig): void;
}

// internal datastructures to managed EventSources
type IEventSourceDictionary = {
  [key: string]: { eventSource: SlotEventSource; trigger: Moli.behaviour.EventTrigger } | undefined;
};

type IEventSources = {
  window: IEventSourceDictionary;
  document: IEventSourceDictionary;
  element: IEventSourceDictionary;
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
 * @internal
 */
export class SlotEventService {
  /**
   * Internal data structure to add responses for the SlotRenderEndedEvent. We require this
   * so we can remove responses that are finished (Promise resolved) and don't create a memory
   * leak for single page applications. This would not be necessary if the gpt tag would have
   * the ability to remove listeners.
   */
  private readonly slotRenderEndedEventCallbacks: Set<
    (event: googletag.events.ISlotRenderEndedEvent) => void
  > = new Set();

  private eventSources: IEventSources = {
    window: {},
    document: {},
    element: {}
  };

  constructor(private readonly logger: Moli.MoliLogger) {}

  /**
   * Initialize the service once the gpt tag is loaded.
   *
   * @param googletag the available googletag
   * @param env
   */
  public initialize(googletag: googletag.IGoogleTag, env: Moli.Environment): void {
    switch (env) {
      case 'production':
        // Initialize the listener only once and manage the responses internally
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
  public awaitAllAdSlotsRendered(
    adSlots: Moli.AdSlot[]
  ): Promise<googletag.events.ISlotRenderEndedEvent[]> {
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
   * @param throttled duration in seconds in which all events are discarded before the next event will be emitted
   * @param window global window object
   */
  public getOrCreateEventSource(
    trigger: Moli.behaviour.EventTrigger,
    throttled: number | undefined,
    window: Window
  ): ISlotEventSource {
    const dictionary = this.getEventSourceDictionary(trigger, window);
    const eventSource = dictionary[trigger.event] || {
      eventSource: this.createEventSource(trigger, throttled, window),
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
      delete this.eventSources.element[eventName];
      const element = window.document.querySelector(source);
      if (eventSource && element) {
        element.removeEventListener(trigger.event, eventSource.eventSource);
      }
    } else if (source === window) {
      const eventSource = this.eventSources.window[eventName];
      delete this.eventSources.window[eventName];
      if (eventSource) {
        window.removeEventListener(eventName, eventSource.eventSource);
      }
    } else {
      const eventSource = this.eventSources.document[eventName];
      delete this.eventSources.document[eventName];
      if (eventSource) {
        window.document.removeEventListener(eventName, eventSource.eventSource);
      }
    }
  }

  /**
   * Removes all registered listeners on window, document and elements
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
      element: {}
    };
  }

  private getEventSourceDictionary(
    trigger: Moli.behaviour.EventTrigger,
    window: Window
  ): IEventSourceDictionary {
    const source = trigger.source;
    if (typeof source === 'string') {
      return this.eventSources.element;
    } else if (source === window) {
      return this.eventSources.window;
    } else {
      return this.eventSources.document;
    }
  }

  private createEventSource(
    trigger: Moli.behaviour.EventTrigger,
    throttled: number | undefined,
    window: Window
  ): SlotEventSource {
    this.logger.debug('SlotEventService', `create EventSource for trigger`, trigger);
    const eventSource = new SlotEventSource(throttled);

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
  private callbacks: CallbackConfig[];

  /**
   * by default all events can pass
   */
  private isNotThrottled = true;

  /**
   * @param throttleDuration duration in seconds - the event source will throw away events if they were fired in the throttled duration
   */
  constructor(private readonly throttleDuration: number | undefined) {
    this.callbacks = [];
  }

  public handleEvent(evt: Event): void {
    if (this.throttleDuration) {
      if (this.isNotThrottled) {
        this.fireCallbacksAndClean(evt);
        this.isNotThrottled = false;

        // allow events after the throttle duration has settled
        setTimeout(() => {
          this.isNotThrottled = true;
        }, this.throttleDuration * 1000);
      }
    } else {
      this.fireCallbacksAndClean(evt);
    }
  }

  public addCallback(callbackCfg: CallbackConfig): void {
    this.callbacks.push(callbackCfg);
  }

  private fireCallbacksAndClean(evt: Event) {
    this.callbacks = this.callbacks.filter(({ callback, permanent }) => {
      // call the function first, then check for permanent
      // do both in `.filter` to avoid double iteration over `callbacks`
      callback(evt);
      return permanent;
    });
  }
}
