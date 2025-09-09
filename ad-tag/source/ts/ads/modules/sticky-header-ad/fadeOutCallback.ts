import { RenderEventResult } from './renderResult';

/**
 *
 * @param container
 * @param target
 * @param adRenderResult
 * @param navbar
 * @param navbarHiddenClass
 * @param fadeOutClassName
 */
export const intersectionObserverFadeOutCallback =
  (
    container: HTMLDivElement,
    target: Element | null,
    adRenderResult: Promise<RenderEventResult>,
    navbar: Element | null,
    navbarHiddenClass: string | null,
    fadeOutClassName: string
  ): IntersectionObserverCallback =>
  entries => {
    // initially there maybe two events, for navbar and the target element
    entries.forEach(entry => {
      // fadeout the ad if the observed element is the target
      if (target && entry.target === target) {
        // wait for the ad to be rendered before hiding it
        adRenderResult.then(result => {
          if (
            // user scrolls down
            entry.isIntersecting ||
            // user starts below observed DOM
            (!entry.isIntersecting && entry.boundingClientRect.y < 0) ||
            // if the ad is empty or an advertiser which is not allowed for this format, hide it
            result === 'empty' ||
            result === 'disallowed'
          ) {
            container.classList.add(fadeOutClassName);
          } else if (entry.boundingClientRect.y >= 0 && result === 'standard') {
            // if the ad should be visible again, because it's above the viewport and the ad is not empty and the
            // advertiser is allowed, remove the fadeout class
            container.classList.remove(fadeOutClassName);
          }
        });
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
