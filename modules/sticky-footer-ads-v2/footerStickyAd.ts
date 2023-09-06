import { googletag, Moli } from '@highfivve/ad-tag';
import { DeviceWithId } from './index';

const adStickyContainerDataRef = '[data-ref=new-sticky-ad]';
const adStickyCloseButtonDataRef = '[data-ref=new-sticky-ad-close]';
const adStickyCloseButtonContent = '.h5v-closeButtonContent';

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
 *
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
  footerStickyDomIds: DeviceWithId[],
  disallowedAdvertiserIds: number[],
  breakingPoint: string = '767px',
  closingButtonText?: string
): void => {
  const adSticky = window.document.querySelector<HTMLElement>(adStickyContainerDataRef);
  const closeButton = window.document.querySelector(adStickyCloseButtonDataRef);
  const closeButtonContent = window.document.querySelector(adStickyCloseButtonContent);

  if (adSticky && closeButton) {
    log.debug(
      'mobile-sticky-ad',
      'Running initAdSticky with defined sticky container and close button'
    );
    const isMobile =
      Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0) <
      parseInt(breakingPoint, 10);

    // Don't add the content to the button, if already added
    if (!closeButtonContent) {
      // Add an X svg as a content of the button, if no custom text was applied
      if (!closingButtonText) {
        const closeButtonSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        closeButtonSvg.setAttribute('width', '24');
        closeButtonSvg.setAttribute('height', '24');

        const closeButtonPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        closeButtonPath.classList.add('h5v-closeButtonContent');
        closeButtonPath.setAttribute('d', 'M7 10l5 5 5-5z');
        closeButtonSvg.appendChild(closeButtonPath);
        closeButton.appendChild(closeButtonSvg);
      } else {
        closeButton.textContent = closingButtonText;
      }
    }

    // find the footerId based on the device and remove the other one
    const desktopFooterId = footerStickyDomIds.find(domId => domId.device === 'desktop')?.id;
    const mobileFooterId = footerStickyDomIds.find(domId => domId.device === 'mobile')?.id;

    const desktopFooterElement = desktopFooterId && document.getElementById(desktopFooterId);
    const mobileFooterElement = mobileFooterId && document.getElementById(mobileFooterId);

    const footerStickyDomId = footerStickyDomIds.map(footerDomId => {
      if (isMobile && mobileFooterElement) {
        desktopFooterElement && desktopFooterElement.remove();
        return footerDomId.id;
      } else if (!isMobile && desktopFooterElement) {
        mobileFooterElement && mobileFooterElement.remove();
        return footerDomId.id;
      }
    })[0];

    closeButton.addEventListener('click', () => {
      adSticky.style.transform = 'translateY(150%)'; // Slide down out of the viewport including the close button
      adSticky.addEventListener(
        'transitionend',
        () => {
          adSticky.remove(); // Remove the container from the DOM after animation
        },
        { once: true }
      ); // Ensure the event listener is executed only once

      const slot = window.googletag
        .pubads()
        .getSlots()
        .find(slot => slot.getSlotElementId() === footerStickyDomId);

      // there are cases where the ad slot is not there. This may be the case when
      // * the ad slot has already been deleted (user clicked two times on the button)
      // * some weird ad blocker stuff
      // * ad reload may have already removed the slot
      if (slot) {
        window.googletag.destroySlots([slot]);
      }
    });

    // hide mobile sticky for advertiser with custom mobile sticky creative
    if (env === 'production' && footerStickyDomId) {
      const onRenderResult = ([renderResult]: [RenderEventResult, void]): Promise<void> => {
        // false means that the slot should not be destroyed. If it's not false,
        // we receive the renderEndedEvent, which grants us access to the slot
        // that should be destroyed
        log.debug('mobile-sticky-ad', `result ${renderResult}`);
        if (renderResult === 'disallowed') {
          log.debug('mobile-sticky-ad', 'hide mobile sticky container');
          if (adSticky) {
            adSticky.remove();
          }
          return Promise.resolve();
        } else if (renderResult === 'standard') {
          // if it's a standard render then create a new listener set and
          // wait for the results
          return Promise.all([
            stickyRenderedEvent(adSticky, footerStickyDomId, disallowedAdvertiserIds, window),
            stickyOnLoadEvent(footerStickyDomId, window)
          ]).then(onRenderResult);
        }
        return Promise.resolve();
      };

      // wait for the slot render ended
      Promise.all([
        stickyRenderedEvent(adSticky, footerStickyDomId, disallowedAdvertiserIds, window),
        stickyOnLoadEvent(footerStickyDomId, window)
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
