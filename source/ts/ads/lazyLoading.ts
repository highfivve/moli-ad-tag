import { Moli } from '../types/moli';
import Trigger = Moli.behaviour.Trigger;
import EventTrigger = Moli.behaviour.EventTrigger;
import VisibleTrigger = Moli.behaviour.VisibleTrigger;

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

const createEventLazyLoader = (trigger: EventTrigger): ILazyLoader => {
  return {
    onLoad: () => {
      return new Promise<void>(resolve => document.addEventListener(trigger.event, () => {
        resolve();
      }, { once: true, passive: true }));
    }
  };
};

const createVisibleLazyLoader = (trigger: VisibleTrigger): ILazyLoader => {
  return {
    onLoad: () => Promise.reject(`Event trigger not implemented yet for domID ${trigger.domId}`)
  };
};

export const createLazyLoader = (trigger: Trigger): ILazyLoader => {
  switch (trigger.name) {
    case 'event':
      return createEventLazyLoader(trigger);
    case 'visible':
      return createVisibleLazyLoader(trigger);
    default:
      return {
        onLoad: () => Promise.reject(`Invalid trigger configuration: ${JSON.stringify(trigger)}`)
      };
  }
};
