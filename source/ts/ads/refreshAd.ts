import { Moli } from '../types/moli';
import Trigger = Moli.behaviour.Trigger;
import EventTrigger = Moli.behaviour.EventTrigger;
import { SlotEventService } from './slotEventService';

/**
 * == Refresh Listener ==
 *
 * Class to define refreshable logic for Ads
 *
 */
export interface IAdRefreshListener {

  /**
   * addAdRefreshListener:
   *
   *    - Adds an event listener EACH TIME this method is called
   *    - Calls the function, passed as parameter, as callback
   *    - The function should only be called once
   *    - Old listeners are not cleaned up, as duplicate instances are discarded automatically
   *
   * @param {(event: CustomEvent) => void} func
   */
  addAdRefreshListener(func: EventListenerOrEventListenerObject): void;
}

/**
 * We call the callback function each time the event 'trigger.event' is triggered.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener:
 *
 *      If multiple identical EventListeners are registered on the same EventTarget
 *      with the same parameters, the duplicate instances are discarded.
 *      They do not cause the EventListener to be called twice,
 *      and they do not need to be removed manually with the removeEventListener() method.
 *
 * @param trigger the trigger configuration
 * @param slotEventService
 * @param window
 * @throws an error if the trigger.source is invalid
 */
const createEventRefreshListener = (trigger: EventTrigger, slotEventService: SlotEventService, window: Window): IAdRefreshListener => {
  return {
    addAdRefreshListener(callback: EventListenerOrEventListenerObject): void {
      slotEventService.getOrCreateEventSource(trigger, window).setCallback(callback);
    }
  };
};

/**
 *
 * @param trigger the trigger configuration for the refresh listener
 * @param slotEventService
 * @param window
 * @returns an IAdRefreshListener if possible otherwise null
 */
export const createRefreshListener = (trigger: Trigger, slotEventService: SlotEventService, window: Window): IAdRefreshListener => {
  switch (trigger.name) {
    case 'event':
      return createEventRefreshListener(trigger, slotEventService, window);
    default:
      throw new Error(`Unsupported trigger ${trigger.name}`);
  }
};
