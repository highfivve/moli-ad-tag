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
  addAdRefreshListener(func: (event: CustomEvent) => void): void;
}


/**
 * We call the callback function each time the event 'answers.sorting.ad.refresh' is triggered.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener:
 *
 *      If multiple identical EventListeners are registered on the same EventTarget
 *      with the same parameters, the duplicate instances are discarded.
 *      They do not cause the EventListener to be called twice,
 *      and they do not need to be removed manually with the removeEventListener() method.
 *
 * @param {(event: CustomEvent) => void}
 */
export class AnswerSortingChanged implements IAdRefreshListener {

  addAdRefreshListener(callback: (event: CustomEvent) => void): void {
    document.addEventListener('answers.sorting.ad.refresh', callback);
  }
}
