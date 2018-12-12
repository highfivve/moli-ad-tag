import { Moli } from '../types/moli';
import Trigger = Moli.behaviour.Trigger;
import EventTrigger = Moli.behaviour.EventTrigger;

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

const getElementForListener = (trigger: EventTrigger): Window | Document | Element => {
  if (typeof trigger.source === 'string') {
    const element = document.querySelector(trigger.source);
    if (element) {
      return element;
    } else {
      throw new Error(`Invalid query selector for refresh listener trigger: ${trigger.source}`);
    }
  } else {
    return trigger.source;
  }
};

const createEventLazyLoader = (trigger: EventTrigger): ILazyLoader => {
  return {
    onLoad: () => {
      return new Promise<void>((resolve, reject) => {
        try {
          getElementForListener(trigger).addEventListener(trigger.event, () => {
            resolve();
          }, { once: true, passive: true });
        } catch (e) {
            reject(e);
        }
      });
    }
  };
};

export const createLazyLoader = (trigger: Trigger): ILazyLoader => {
  switch (trigger.name) {
    case 'event':
      return createEventLazyLoader(trigger);
    default:
      return {
        onLoad: () => Promise.reject(`Invalid trigger configuration: ${JSON.stringify(trigger)}`)
      };
  }
};
