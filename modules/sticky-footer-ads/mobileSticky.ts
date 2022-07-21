import { googletag, Moli } from '@highfivve/ad-tag';

const adStickyContainerDataRef = '[data-ref=sticky-ad]';
const adStickyCloseButtonDataRef = '[data-ref=sticky-ad-close]';

/**
 * empty: mobile sticky load was empty
 * disallowed: an advertiser that brings its own creative was rendered
 * standard: a regular creative was loaded
 */
type RenderEventResult = 'empty' | 'disallowed' | 'standard';

const stickyRenderedEvent = (
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
        resolve('empty');
        window.googletag.pubads().removeEventListener('slotRenderEnded', listener);
      } else if (!!event.advertiserId && disallowedAdvertiserIds.includes(event.advertiserId)) {
        resolve('disallowed');
        window.googletag.pubads().removeEventListener('slotRenderEnded', listener);
      } else {
        resolve('standard');
      }
    };

    window.googletag.pubads().addEventListener('slotRenderEnded', listener);
  });

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
    closeButton.addEventListener(
      'click',
      () => {
        // hide the ad slot
        adSticky.style.setProperty('display', 'none');

        // destroy the slot so it doesn't get reloaded or refreshed by accident
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
      const onRenderResult = ([renderResult]: [RenderEventResult, void]) => {
        // false means that the slot should not be destroyed. If it's not false,
        // we receive the renderEndedEvent, which grants us access to the slot
        // that should be destroyed
        log.debug('mobile-sticky-ad', `result ${renderResult}`);
        if (renderResult === 'disallowed') {
          log.debug('mobile-sticky-ad', 'hide mobile sticky container');
          if (adSticky) {
            adSticky.style.setProperty('display', 'none');
          }
        } else if (renderResult === 'standard') {
          // if it's a standard render then create a new listener set and
          // wait for the results
          return Promise.all([
            stickyRenderedEvent(mobileStickyDomId, disallowedAdvertiserIds, window),
            stickyOnLoadEvent(mobileStickyDomId, window)
          ]).then(onRenderResult);
        }
      };

      // wait for the slot render ended
      Promise.all([
        stickyRenderedEvent(mobileStickyDomId, disallowedAdvertiserIds, window),
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
