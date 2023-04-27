import { googletag, Moli } from '@highfivve/ad-tag';

const adStickyContainerDataRef = '[data-ref=sticky-ad]';
const adStickyCloseButtonDataRef = '[data-ref=sticky-ad-close]';

/**
 * empty: mobile sticky load was empty
 * disallowed: an advertiser that brings its own creative was rendered
 * standard: a regular creative was loaded
 */
type RenderEventResult = 'empty' | 'disallowed' | 'standard';

/**
 * Called when the iframe gets rendered and where our logic for disallowed advertisers with special formats is.
 */
const stickyRenderedEvent = (
  adSticky: HTMLElement | undefined,
  mobileStickyDomId: string,
  disallowedAdvertiserIds: number[],
  window: Window & googletag.IGoogleTagWindow
): Promise<RenderEventResult> =>
  new Promise(resolve => {
    const listener = (event: googletag.events.ISlotRenderEndedEvent): void => {
      if (event.slot.getSlotElementId() !== mobileStickyDomId) {
        return;
      }

      if (event.isEmpty) {
        if (adSticky) {
          adSticky.style.setProperty('display', 'none');
        }
        resolve('empty');
      } else if (!!event.advertiserId && disallowedAdvertiserIds.includes(event.advertiserId)) {
        resolve('disallowed');
      } else {
        resolve('standard');
      }
      window.googletag.pubads().removeEventListener('slotRenderEnded', listener);
    };

    window.googletag.pubads().addEventListener('slotRenderEnded', listener);
  });

/**
 * Called when the iFrame was successfully loaded and everything in it was executed.
 */
const stickyOnLoadEvent = (
  mobileStickyDomId: string,
  window: Window & googletag.IGoogleTagWindow
): Promise<void> =>
  new Promise(resolve => {
    const listener = (event: googletag.events.ISlotOnloadEvent): void => {
      if (event.slot.getSlotElementId() !== mobileStickyDomId) {
        return;
      }
      resolve();
      window.googletag.pubads().removeEventListener('slotOnload', listener);
    };

    window.googletag.pubads().addEventListener('slotOnload', listener);
  });

/**
 * ## Ad Sticky
 *
 * Initializes the close button for the sticky ad.
 */
export const initAdSticky = (
  window: Window & googletag.IGoogleTagWindow,
  env: Moli.Environment,
  log: Moli.MoliLogger,
  mobileStickyDomId: string,
  disallowedAdvertiserIds: number[]
): void => {
  const adSticky = window.document.querySelector<HTMLElement>(adStickyContainerDataRef);
  const closeButton = window.document.querySelector(adStickyCloseButtonDataRef);

  if (adSticky && closeButton) {
    adSticky.style.setProperty('display', 'inherit');

    closeButton.addEventListener(
      'click',
      () => {
        // hide the ad slot
        adSticky.style.setProperty('display', 'none');

        // destroy the slot, so it doesn't get reloaded or refreshed by accident
        const slot = window.googletag
          .pubads()
          .getSlots()
          .find(slot => slot.getSlotElementId() === mobileStickyDomId);

        // there are cases where the ad slot is not there. This may be the case when
        // * the ad slot has already been deleted (user clicked two times on the button)
        // * some weird ad blocker stuff
        // * ad reload may have already removed the slot
        if (slot) {
          window.googletag.destroySlots([slot]);
        }
      },
      // the slot can only be hidden once
      { once: true, passive: true }
    );

    // hide mobile sticky for advertiser with custom mobile sticky creative
    if (env === 'production') {
      const onRenderResult = ([renderResult]: [RenderEventResult, void]): Promise<void> => {
        // false means that the slot should not be destroyed. If it's not false,
        // we receive the renderEndedEvent, which grants us access to the slot
        // that should be destroyed
        log.debug('mobile-sticky-ad', `result ${renderResult}`);
        if (renderResult === 'disallowed') {
          log.debug('mobile-sticky-ad', 'hide mobile sticky container');
          if (adSticky) {
            adSticky.style.setProperty('display', 'none');
          }
          return Promise.resolve();
        } else if (renderResult === 'standard') {
          // if it's a standard render then create a new listener set and
          // wait for the results
          return Promise.all([
            stickyRenderedEvent(adSticky, mobileStickyDomId, disallowedAdvertiserIds, window),
            stickyOnLoadEvent(mobileStickyDomId, window)
          ]).then(onRenderResult);
        }
        return Promise.resolve();
      };

      // wait for the slot render ended
      Promise.all([
        stickyRenderedEvent(adSticky, mobileStickyDomId, disallowedAdvertiserIds, window),
        stickyOnLoadEvent(mobileStickyDomId, window)
      ]).then(onRenderResult);
    }
  } else {
    log.warn(
      '[mobile-sticky]',
      `Could not find adSticky container ${adStickyContainerDataRef} or closeButton ${adStickyCloseButtonDataRef}`,
      adSticky,
      closeButton
    );
  }
};
