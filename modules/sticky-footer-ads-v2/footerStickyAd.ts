import { googletag, Moli } from '@highfivve/ad-tag';

const adStickyContainerDataRef = '[data-ref=h5v-sticky-ad]';
const adStickyCloseButtonDataRef = '[data-ref=h5v-sticky-ad-close]';
// is initialized after init
const adStickyCloseButtonContent = '.h5v-closeButtonContent';
const adStickHidingClass = 'h5v-footerAd--hidden';
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
        resolve('empty');
      } else if (event.advertiserId && disallowedAdvertiserIds.includes(event.advertiserId)) {
        resolve('disallowed');
      } else if (
        !!event.companyIds &&
        disallowedAdvertiserIds.some(id => event.companyIds?.includes(id))
      ) {
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
  footerStickyDomId: string,
  window: Window & googletag.IGoogleTagWindow
): Promise<void> =>
  new Promise(resolve => {
    const listener = (event: googletag.events.ISlotOnloadEvent): void => {
      if (event.slot.getSlotElementId() !== footerStickyDomId) {
        return;
      }
      resolve();
      window.googletag.pubads().removeEventListener('slotOnload', listener);
    };

    window.googletag.pubads().addEventListener('slotOnload', listener);
  });

const hideAdSlot = (element: HTMLElement): void => {
  element.classList.add(adStickHidingClass);
};

const showAdSlot = (element: HTMLElement): void => {
  element.classList.remove(adStickHidingClass);
};
/**
 * ## Ad Sticky
 *
 * Initializes the close button for the sticky ad.
 */
export const initAdSticky = (
  window: Window & googletag.IGoogleTagWindow,
  env: Moli.Environment,
  log: Moli.MoliLogger,
  footerStickyDomId: string,
  disallowedAdvertiserIds: number[],
  closingButtonText?: string
): void => {
  const stickyAd = 'sticky-ad';

  const adSticky = window.document.querySelector<HTMLElement>(adStickyContainerDataRef);
  const closeButton = window.document.querySelector(adStickyCloseButtonDataRef);
  const closeButtonContent = window.document.querySelector(adStickyCloseButtonContent);

  if (adSticky && closeButton) {
    log.debug(stickyAd, 'Running initAdSticky with defined sticky container and close button');

    // Don't add the content to the button, if already added
    if (!closeButtonContent) {
      // Add an X svg as a content of the button, if no custom text was applied
      if (!closingButtonText) {
        if (!closeButton.querySelector('svg')) {
          const closeButtonSvg = window.document.createElementNS(
            'http://www.w3.org/2000/svg',
            'svg'
          );
          closeButtonSvg.setAttribute('width', '24');
          closeButtonSvg.setAttribute('height', '24');

          const closeButtonPath = window.document.createElementNS(
            'http://www.w3.org/2000/svg',
            'path'
          );
          closeButtonPath.classList.add(adStickyCloseButtonContent);
          closeButtonPath.setAttribute('d', 'M7 10l5 5 5-5z');
          closeButtonSvg.appendChild(closeButtonPath);
          closeButton.appendChild(closeButtonSvg);
        }
      } else {
        closeButton.textContent = closingButtonText;
      }
    }

    closeButton.addEventListener('click', () => {
      hideAdSlot(adSticky); // Hide the footer including the close button
      adSticky.addEventListener(
        'transitionend',
        function () {
          adSticky.remove(); // Remove the container from the DOM after animation
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
        },
        { once: true }
      ); // Ensure the event listener is executed only once
    });

    const onRenderResult = (renderResult: RenderEventResult): Promise<void> => {
      // false means that the slot should not be destroyed. If it's not false,
      // we receive the renderEndedEvent, which grants us access to the slot
      // that should be destroyed
      log.debug(stickyAd, `result ${renderResult}`);

      if (renderResult === 'disallowed' || renderResult === 'empty') {
        log.debug(stickyAd, 'stickyFooter container');
        hideAdSlot(adSticky);

        return Promise.resolve();
      } else if (renderResult === 'standard') {
        showAdSlot(adSticky);

        // if it's a standard render then create a new listener set and
        // wait for the results

        const stickyOnLoadEventPromise = stickyOnLoadEvent(footerStickyDomId, window);
        return stickyRenderedEvent(adSticky, footerStickyDomId, disallowedAdvertiserIds, window)
          .then(result =>
            result === 'empty' || result === 'disallowed'
              ? Promise.resolve(result)
              : stickyOnLoadEventPromise.then(() => result)
          )
          .then(onRenderResult);
      }
      return Promise.resolve();
    };

    // hide mobile sticky for advertiser with custom mobile sticky creative
    if (env === 'production') {
      if (footerStickyDomId) {
        const stickyOnLoadEventPromise = stickyOnLoadEvent(footerStickyDomId, window);

        stickyRenderedEvent(adSticky, footerStickyDomId, disallowedAdvertiserIds, window)
          .then(result =>
            result === 'empty' || result === 'disallowed'
              ? Promise.resolve(result)
              : stickyOnLoadEventPromise.then(() => result)
          )
          .then(onRenderResult);
      } else {
        log.warn(
          '[sticky-footer-ad]',
          `Could not find adSticky container ${adStickyContainerDataRef} or closeButton ${adStickyCloseButtonDataRef}`,
          adSticky,
          closeButton
        );
      }
    } else {
      // fake a render event
      onRenderResult('standard');
    }
  } else {
    log.warn(
      '[sticky-footer-ad]',
      `Could not find adSticky container ${adStickyContainerDataRef} or closeButton ${adStickyCloseButtonDataRef}`,
      adSticky,
      closeButton
    );
  }
};
