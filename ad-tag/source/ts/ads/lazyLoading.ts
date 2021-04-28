import { Moli } from '../types/moli';
import Trigger = Moli.behaviour.Trigger;
import EventTrigger = Moli.behaviour.EventTrigger;
import { SlotEventService } from './slotEventService';

/**
 * == Lazy Loader ==
 *
 * Class to define lazy loading logic for Ads.
 *
 */
export interface ILazyLoader {
  /**
   * @returns {Promise<void>} a promise that resolves when the lazy loaded content should be triggered
   */
  onLoad(): Promise<void>;
}

const createEventLazyLoader = (
  trigger: EventTrigger,
  slotEventService: SlotEventService,
  window: Window
): ILazyLoader => {
  return {
    onLoad: () => {
      return new Promise<void>((resolve, reject) => {
        try {
          slotEventService.getOrCreateEventSource(trigger, undefined, window).addCallback({
            callback: () => {
              resolve();
            },
            permanent: false
          });
        } catch (e) {
          reject(e);
        }
      });
    }
  };
};

export const createLazyLoader = (
  trigger: Trigger,
  slotEventService: SlotEventService,
  window: Window
): ILazyLoader => {
  switch (trigger.name) {
    case 'event':
      return createEventLazyLoader(trigger, slotEventService, window);
    default:
      return {
        onLoad: () => Promise.reject(`Invalid trigger configuration: ${JSON.stringify(trigger)}`)
      };
  }
};
