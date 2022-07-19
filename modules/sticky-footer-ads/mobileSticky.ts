import { googletag, Moli } from '@highfivve/ad-tag';

const adStickyContainerDataRef = '[data-ref=sticky-ad]';
const adStickyCloseButtonDataRef = '[data-ref=sticky-ad-close]';

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
      const listener = (event: googletag.events.ISlotRenderEndedEvent): void => {
        if (event.slot.getSlotElementId() !== mobileStickyDomId) {
          return;
        }

        if (
          event.isEmpty ||
          // don't render for excluded advertiser ids
          (!!event.advertiserId && disallowedAdvertiserIds.includes(event.advertiserId))
        ) {
          window.googletag.destroySlots([event.slot]);
          if (adSticky) {
            // change the id to make sure it will not be reloaded
            adSticky.setAttribute('id', `removed_${Math.round(Math.random() * 100000)}`);
            adSticky.style.setProperty('display', 'none');
          }
          window.googletag.pubads().removeEventListener('slotRenderEnded', listener);
        }
      };

      window.googletag.pubads().addEventListener('slotRenderEnded', listener);
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
