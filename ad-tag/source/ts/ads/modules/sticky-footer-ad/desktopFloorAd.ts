import { googletag } from 'ad-tag/types/googletag';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { Environment } from 'ad-tag/types/moliConfig';

const closeButtonDataRef = 'footer-ad-close-button';
const containerDataRefSelector = '[data-ref=h5-footer-ad-container]';
const closeButtonDataRefSelector = `[data-ref=${closeButtonDataRef}]`;

const css = {
  adSlot: 'h5-footer-ad',
  container: 'h5-footer-ad-container',
  footerAdClose: 'h5-footer-ad-close',
  isShiftedBottom: 'is-shifted-bottom'
};

/**
 * This wraps functionality to show and hide an interactive desktop footer ad component with a close
 * button depending on some parameters.
 *
 *
 * @see https://developers.google.com/publisher-tag/reference#googletag.events.slotrenderendedevent
 * @param window
 * @param floorAdDomId
 * @param disallowedAdvertiserIds
 * @param log
 */
const renderFooterAd =
  (
    window: Window & googletag.IGoogleTagWindow,
    floorAdDomId: string,
    disallowedAdvertiserIds: number[],
    log: MoliRuntime.MoliLogger
  ) =>
  (event: googletag.events.ISlotRenderEndedEvent) => {
    const slot = event.slot;
    const footerAdContainerElement =
      window.document.body.querySelector<HTMLElement>(containerDataRefSelector);
    const footerAdElement = window.document.getElementById(floorAdDomId);

    const removeFooterAd = () => {
      if (slot.getSlotElementId() === floorAdDomId && footerAdContainerElement) {
        // in test mode, googletag may not be defined
        window.googletag?.destroySlots([slot]);
        footerAdContainerElement.remove();
      }
    };

    if (
      !footerAdContainerElement ||
      !footerAdElement ||
      slot.getSlotElementId() !== floorAdDomId ||
      // don't render anything if slot render returns empty
      event.isEmpty ||
      // don't render for excluded advertiser ids
      (!!event.advertiserId && disallowedAdvertiserIds.includes(event.advertiserId)) ||
      // minimum is 768px width - h5_footer_ad only on desktop!
      window.matchMedia('(max-width: 767px)').matches
    ) {
      log.debug('[footer-ad]', 'remove footer ad container');

      return;
    }

    // add close button only once - that's enough. Happens on ad reload
    if (window.document.body.querySelector(closeButtonDataRefSelector)) {
      return;
    }

    const footerAdElementClose = document.createElement('button');
    footerAdElementClose.classList.add(css.footerAdClose);
    footerAdElementClose.setAttribute('aria-label', 'Anzeige entfernen');
    footerAdElementClose.setAttribute('data-ref', closeButtonDataRef);

    footerAdElement.classList.add(css.adSlot);

    // for the combination of high ad (> 200px) and low vertical screen resolution, we shift the ad 70px
    // to the bottom.
    if (
      Array.isArray(event.size) &&
      event.size[1] > 200 &&
      window.matchMedia('(max-height: 800px)').matches
    ) {
      footerAdElement.classList.add(css.isShiftedBottom);
    }

    footerAdContainerElement.classList.add(css.container);
    footerAdContainerElement.style.setProperty('display', 'block');
    footerAdContainerElement.appendChild(footerAdElementClose);

    footerAdElementClose.addEventListener('click', () => removeFooterAd());
  };

export const setupFooterAdListener = (
  window: Window & googletag.IGoogleTagWindow,
  env: Environment,
  log: MoliRuntime.MoliLogger,
  floorAdDomId: string,
  disallowedAdvertiserIds: number[]
): void => {
  if (env === 'production') {
    window.googletag
      .pubads()
      .addEventListener(
        'slotRenderEnded',
        renderFooterAd(window, floorAdDomId, disallowedAdvertiserIds, log)
      );
  } else {
    // fake a render event
    renderFooterAd(
      window,
      floorAdDomId,
      disallowedAdvertiserIds,
      log
    )({
      advertiserId: 1,
      size: [728, 90],
      isEmpty: false,
      slot: {
        getSlotElementId: (): string => floorAdDomId
      }
    } as any);
  }
};
