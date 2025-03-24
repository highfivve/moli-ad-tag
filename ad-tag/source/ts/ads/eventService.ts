import { MoliRuntime } from '../types/moliRuntime';

interface EventMap {
  beforeRequestAds: { runtimeConfig: MoliRuntime.MoliRuntimeConfig };
  afterRequestAds: { state: MoliRuntime.state.AfterRequestAdsStates };
}

type EventType = keyof EventMap;
type EventListener<T extends EventType> = (event: EventMap[T]) => void;

interface EventListenerOptions {
  /**
   * When true, the event listener will automatically be removed after it is invoked for the first time.
   * If false or not specified, the listener will be called every time the event is emitted.
   * @default false
   */
  readonly once?: boolean;
}

/**
 * Service for emitting and subscribing to events.
 * @example ```
 * eventService.addEventListener('beforeRequestAds', event => {
 *   event.runtimeConfig;
 * });
 * eventService.emit('beforeRequestAds', { runtimeConfig: getRuntimeConfig() });
 * ```
 *
 * The moli ad tag emits events for external systems or itself to trigger actions. Examples include
 *
 * - `beforeRequestAds`: correlate page view with requestAds() calls to see where mismatches occur
 * - `afterRequestAds`: to trigger actions after the ads have been loaded. Or to check for errors
 *
 */
export class EventService {
  private eventListeners: Map<EventType, Set<EventListener<any>>> = new Map();
  private oneTimeListeners: Map<EventType, Set<EventListener<any>>> = new Map();

  /**
   * Add an event listener for a specific event. If the event has already been emitted, the listener will not be called.
   *
   * @param event the event type
   * @param listener callback function
   * @param options optional configuration
   */
  addEventListener = <T extends EventType>(
    event: T,
    listener: EventListener<T>,
    options: EventListenerOptions = {}
  ): void => {
    const targetMap = options.once ? this.oneTimeListeners : this.eventListeners;

    if (!targetMap.has(event)) {
      targetMap.set(event, new Set());
    }
    targetMap.get(event)?.add(listener);
  };

  removeEventListener = <T extends EventType>(event: T, listener: EventListener<T>): void => {
    this.eventListeners.get(event)?.delete(listener);
    this.oneTimeListeners.get(event)?.delete(listener);
  };

  /**
   * Emits an event to all subscribers. If a listener throws an error, it will be caught and logged,
   * allowing other listeners to still execute.
   */
  emit = <T extends EventType>(event: T, data: EventMap[T]): void => {
    // Regular listeners
    this.eventListeners.get(event)?.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        // In a real application, you might want to use a proper logger here
        console.error(`Error in event listener for ${event}:`, error);
      }
    });

    // One-time listeners
    const oneTimeListenersForEvent = this.oneTimeListeners.get(event);
    if (oneTimeListenersForEvent) {
      oneTimeListenersForEvent.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in one-time event listener for ${event}:`, error);
        } finally {
          // Always remove one-time listeners, even if they throw
          oneTimeListenersForEvent.delete(listener);
        }
      });

      // Clean up empty Sets from the oneTimeListeners Map to prevent memory leaks.
      // Once all one-time listeners for an event have been executed and removed,
      // we no longer need to keep the empty Set in our Map.
      if (oneTimeListenersForEvent.size === 0) {
        this.oneTimeListeners.delete(event);
      }
    }
  };
}
