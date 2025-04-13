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
export interface EventService {
  addEventListener<T extends keyof EventMap>(
    event: T,
    listener: EventListener<T>,
    options?: EventListenerOptions
  ): void;
  removeEventListener<T extends keyof EventMap>(event: T, listener: EventListener<T>): void;
  emit<T extends keyof EventMap>(event: T, data: EventMap[T]): void;
}

export const createEventService = (): EventService => {
  const eventListeners = new Map<keyof EventMap, Set<(event: any) => void>>();
  const oneTimeListeners = new Map<keyof EventMap, Set<(event: any) => void>>();

  return {
    addEventListener<T extends keyof EventMap>(
      event: T,
      listener: (event: EventMap[T]) => void,
      options: { once?: boolean } = {}
    ): void {
      const targetMap = options.once ? oneTimeListeners : eventListeners;

      if (!targetMap.has(event)) {
        targetMap.set(event, new Set());
      }
      targetMap.get(event)?.add(listener);
    },

    removeEventListener<T extends keyof EventMap>(
      event: T,
      listener: (event: EventMap[T]) => void
    ): void {
      eventListeners.get(event)?.delete(listener);
      oneTimeListeners.get(event)?.delete(listener);
    },

    emit<T extends keyof EventMap>(event: T, data: EventMap[T]): void {
      // Regular listeners
      eventListeners.get(event)?.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${String(event)}:`, error);
        }
      });

      // One-time listeners
      const oneTimeListenersForEvent = oneTimeListeners.get(event);
      if (oneTimeListenersForEvent) {
        oneTimeListenersForEvent.forEach(listener => {
          try {
            listener(data);
          } catch (error) {
            console.error(`Error in one-time event listener for ${String(event)}:`, error);
          } finally {
            oneTimeListenersForEvent.delete(listener);
          }
        });

        if (oneTimeListenersForEvent.size === 0) {
          oneTimeListeners.delete(event);
        }
      }
    }
  };
};
