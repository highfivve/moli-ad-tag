import { googletag } from 'ad-tag/types/googletag';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { Environment } from 'ad-tag/types/moliConfig';
import { getBrowserStorageValue } from 'ad-tag/util/localStorage';

const interstitialContainerSelector = '[data-ref="h5v-interstitial"]';
const interstitialCloseButtonSelector = '[data-ref="h5v-interstitial-close"]';
const interstitialHidingClass = 'h5v-interstitial--hidden';

/**
 * empty: interstitial load was empty
 * disallowed: an advertiser that brings its own creative was rendered
 * standard: a regular creative was loaded
 */
type RenderEventResult = 'empty' | 'disallowed' | 'standard';

/**
 * Called when the iframe gets rendered and where our logic for disallowed advertisers with special formats is.
 */
const interstitialRenderedEvent = (
  interstitialDomId: string,
  disallowedAdvertiserIds: number[],
  window: Window & googletag.IGoogleTagWindow
): Promise<RenderEventResult> =>
  new Promise(resolve => {
    const listener = (event: googletag.events.ISlotRenderEndedEvent): void => {
      if (event.slot.getSlotElementId() !== interstitialDomId) {
        return;
      }

      if (event.isEmpty) {
        resolve('empty');
      } else if (event.advertiserId && disallowedAdvertiserIds.includes(event.advertiserId)) {
        resolve('disallowed');
      } else {
        resolve('standard');
      }
      window.googletag.pubads().removeEventListener('slotRenderEnded', listener);
    };
    window.googletag.cmd.push(() => {
      window.googletag.pubads().addEventListener('slotRenderEnded', listener);
    });
  });

/**
 * Called when the iFrame was successfully loaded and everything in it was executed.
 *
 */
const interstitialOnLoadEvent = (
  interstitialDomId: string,
  window: Window & googletag.IGoogleTagWindow
): Promise<void> =>
  new Promise(resolve => {
    const listener = (event: googletag.events.ISlotOnloadEvent): void => {
      if (event.slot.getSlotElementId() !== interstitialDomId) {
        return;
      }
      resolve();
      window.googletag.pubads().removeEventListener('slotOnload', listener);
    };

    window.googletag.pubads().addEventListener('slotOnload', listener);
  });

const hideAdSlot = (element: HTMLElement): void => {
  element.classList.add(interstitialHidingClass);
};

const showAdSlot = (element: HTMLElement): void => {
  element.classList.remove(interstitialHidingClass);
};

let timeoutToBeClearedWhenModuleIsInitialized: number | undefined;
/**
 * ## Interstitial
 *
 * Initializes the interstitial module.
 */
export const initInterstitialModule = (
  window: Window & googletag.IGoogleTagWindow,
  env: Environment,
  log: MoliRuntime.MoliLogger,
  interstitialDomId: string,
  disallowedAdvertiserIds: number[],
  closeAutomaticallyAfterMs?: number
): void => {
  // clear the timeout that was set during the last initialization
  clearTimeout(timeoutToBeClearedWhenModuleIsInitialized);

  const interstitial = 'interstitial-module';

  const interstitialAdContainer = window.document.querySelector<HTMLElement>(
    interstitialContainerSelector
  );
  const closeButton = window.document.querySelector<HTMLElement>(interstitialCloseButtonSelector);

  if (closeButton && interstitialAdContainer) {
    log.debug(interstitial, 'Running interstitial module with defined container and close button');

    const closeInterstitial = () => {
      hideAdSlot(interstitialAdContainer);

      const slot = window.googletag
        ?.pubads()
        .getSlots()
        .find(slot => slot.getSlotElementId() === interstitialDomId);

      if (slot) {
        window.googletag.destroySlots([slot]);
      }
    };

    closeButton.addEventListener('click', () => {
      closeInterstitial();
    });

    const onRenderResult = (renderResult: RenderEventResult): Promise<void> => {
      // false means that the slot should not be destroyed. If it's not false,
      // we receive the renderEndedEvent, which grants us access to the slot
      // that should be destroyed
      log.debug(interstitial, `result ${renderResult}`);

      if (renderResult === 'disallowed' || renderResult === 'empty') {
        log.debug(interstitial, 'hide interstitial container');
        hideAdSlot(interstitialAdContainer);

        return Promise.resolve();
      } else if (renderResult === 'standard') {
        showAdSlot(interstitialAdContainer);

        if (closeAutomaticallyAfterMs) {
          timeoutToBeClearedWhenModuleIsInitialized = window.setTimeout(() => {
            closeInterstitial();
          }, closeAutomaticallyAfterMs);
        }

        // if it's a standard render then create a new listener set and
        // wait for the results
        const interstitialOnLoadEventPromise = interstitialOnLoadEvent(interstitialDomId, window);
        return interstitialRenderedEvent(interstitialDomId, disallowedAdvertiserIds, window)
          .then(result =>
            result === 'empty' || result === 'disallowed'
              ? Promise.resolve(result)
              : interstitialOnLoadEventPromise.then(() => result)
          )
          .then(onRenderResult);
      }
      return Promise.resolve();
    };

    switch (env) {
      case 'production':
        const interstitialOnLoadEventPromise = interstitialOnLoadEvent(interstitialDomId, window);

        interstitialRenderedEvent(interstitialDomId, disallowedAdvertiserIds, window)
          .then(result =>
            result === 'empty' || result === 'disallowed'
              ? Promise.resolve(result)
              : interstitialOnLoadEventPromise.then(() => result)
          )
          .then(onRenderResult);
        break;
      case 'test':
        if (!!getBrowserStorageValue('test-interstitial', localStorage)) {
          // if test mode for interstitial is enabled, fake a render event
          onRenderResult('standard');
        } else {
          // if test mode for interstitial is not enabled, we treat it as empty (hidden)
          onRenderResult('empty');
        }
        break;
      default:
        log.warn(interstitial, `Unknown environment: ${env}`);
        break;
    }
  } else {
    log.warn(
      '[interstitial-module]',
      `Could not find interstitial container ${interstitialContainerSelector} or closeButton ${interstitialCloseButtonSelector}`,
      interstitial,
      closeButton
    );
  }
};
