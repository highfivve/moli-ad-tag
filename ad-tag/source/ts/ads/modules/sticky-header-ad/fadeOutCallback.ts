import { RenderEventResult } from './renderResult';

/**
 *
 * @param container
 * @param target
 * @param adRenderResult
 * @param navbar
 * @param navbarHiddenClass
 * @param fadeOutClassName
 * @param minVisibleDurationMs
 * @param windowRef
 */
export const intersectionObserverFadeOutCallback =
  (
    container: HTMLDivElement,
    target: Element | null,
    adRenderResult: Promise<RenderEventResult>,
    navbar: Element | null,
    navbarHiddenClass: string | null,
    fadeOutClassName: string,
    minVisibleDurationMs: number,
    windowRef: Window
  ): IntersectionObserverCallback => {
    let canHide = minVisibleDurationMs <= 0;
    let lastTargetEntry: IntersectionObserverEntry | null = null;

    const shouldFadeOut = (
      entry: IntersectionObserverEntry,
      result: RenderEventResult
    ): boolean =>
      result === 'empty' ||
      result === 'disallowed' ||
      (canHide && (entry.isIntersecting || (!entry.isIntersecting && entry.boundingClientRect.y < 0)));

    const evaluateHide = (entry: IntersectionObserverEntry) => {
      adRenderResult.then(result => {
        if (shouldFadeOut(entry, result)) {
          container.classList.add(fadeOutClassName);
        } else if (entry.boundingClientRect.y >= 0 && result === 'standard') {
          // if the ad should be visible again, because it's above the viewport and the ad is not empty and the
          // advertiser is allowed, remove the fadeout class
          container.classList.remove(fadeOutClassName);
        }
      });
    };

    if (!canHide) {
      windowRef.setTimeout(() => {
        canHide = true;
        // If we have a pending intersection entry and ad is ready, evaluate hide now
        if (lastTargetEntry) {
          evaluateHide(lastTargetEntry);
        }
      }, minVisibleDurationMs);
    }

    return entries => {
      // initially there maybe two events, for navbar and the target element
      entries.forEach(entry => {
        // fadeout the ad if the observed element is the target
        if (target && entry.target === target) {
          lastTargetEntry = entry;
          // wait for the ad to be rendered before hiding it
          evaluateHide(entry);
        } else if (entry.target === navbar && navbarHiddenClass) {
          // apply a separate class if the navbar is not intersecting the viewport anymore
          if (entry.isIntersecting) {
            container.classList.remove(navbarHiddenClass);
          } else {
            container.classList.add(navbarHiddenClass);
          }
        }
      });
    };
  };
