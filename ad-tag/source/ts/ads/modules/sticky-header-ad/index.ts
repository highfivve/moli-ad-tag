/**
 * # Sticky Header Ads
 *
 * Out of page formats for mobile and desktop that are sticky at the top of the page.
 * This is similar to the [Anchor Ads](https://developers.google.com/publisher-tag/samples/display-anchor-ad) provided
 * by Google Ad Manager.
 *
 * See also
 *
 * - https://googleads.github.io/google-publisher-tag-samples/display-anchor-ad/js/demo.html
 * - https://support.google.com/admanager/answer/10452255?hl=en
 *
 * ## Integration
 *
 * In your `index.ts` import and register the module.
 *
 * ```js
 * import { createStickyHeaderAd } from '@highfivve/module-sticky-header-ad';
 * moli.registerModule(createStickyHeaderAd());
 * ```
 *
 * Next you need to add the required HTML and CSS on your page. See the [sticky header ads documentation](https://highfivve.github.io/footer-ads/)
 *
 * **Important**
 * The `data-ref`s are not configurable and are currently hardcoded. Make sure that they are correct.
 *
 * ## Single Page Apps
 *
 * This module is NOT ready for single page applications yet.
 *
 * ## Resources
 *
 * - [Documentation](https://highfivve.github.io/footer-ads/)
 * - [Ads to viewport height ration](https://developers.google.com/publisher-ads-audits/reference/audits/viewport-ad-density?hl=en)
 *
 * @module
 */
import { intersectionObserverFadeOutCallback } from './fadeOutCallback';
import { adRenderResult } from './renderResult';
import { IModule, ModuleType } from 'ad-tag/types/module';
import { modules } from 'ad-tag/types/moliConfig';
import {
  ConfigureStep,
  InitStep,
  LOW_PRIORITY,
  mkConfigureStepOncePerRequestAdsCycle,
  mkPrepareRequestAdsStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';

/**
 * ## Sticky Headers Ad
 *
 * Provides the javascript integration for sticky header ads, which consist of
 *
 * - close button feature
 * - removing HTML if the advertiser provides the entire ad creative
 * - removing HTML if ad is empty
 * - showing HTML if ad is none-empty
 *
 * @see https://highfivve.github.io/footer-ads/
 */
export const createStickyHeaderAd = (): IModule => {
  const name = 'sticky-header-ads';

  /**
   * selects the div wrapping the ad slot
   */
  const containerSelector = '[data-ref="header-ad"]';

  /**
   * selects the close button of the ad slot
   */
  const buttonSelector = '[data-ref="header-ad-close-button"]';

  /**
   * If a none sticky navbar configuration is available, but no css class is configured, this one will
   * be used as default.
   *
   * Overriding this only makes sense if the publisher wants a different class name
   */
  const navbarHiddenClassName = 'h5v-header-ad--navbarHidden';

  /**
   * singleton observer instance. Required for SPA publishers where we need to
   * disconnect and reconnect when the user navigates.
   *
   * The instance is also used to ensure that there's only one observer
   */
  let observer: IntersectionObserver | null = null;

  let stickyHeaderAdConfig: modules.stickyHeaderAd.StickyHeaderAdConfig | null = null;

  const configure__ = (moduleConfig?: modules.ModulesConfig | undefined): void => {
    if (moduleConfig?.stickyHeaderAd?.enabled) {
      stickyHeaderAdConfig = moduleConfig.stickyHeaderAd;
    }
  };

  const config__ = (): Object | null => stickyHeaderAdConfig;

  const initSteps__ = (): InitStep[] => [];

  const configureSteps__ = (): ConfigureStep[] => {
    const config = stickyHeaderAdConfig;
    return config
      ? [
          mkConfigureStepOncePerRequestAdsCycle('sticky-header-ads:cleanup', () => {
            if (observer) {
              observer.disconnect();
              observer = null;
            }
            return Promise.resolve();
          })
        ]
      : [];
  };

  const prepareRequestAdsSteps__ = (): PrepareRequestAdsStep[] => {
    const config = stickyHeaderAdConfig;
    return config
      ? [
          mkPrepareRequestAdsStep(name, LOW_PRIORITY, (ctx, slots) => {
            if (observer) {
              return Promise.resolve();
            }

            const headerSlot = slots.find(slot => slot.moliSlot.domId === config.headerAdDomId);
            // the ad pipeline run didn't contain the header slot
            if (!headerSlot) {
              return Promise.resolve();
            }

            const container =
              ctx.window__.document.querySelector<HTMLDivElement>(containerSelector);
            if (!container) {
              ctx.logger__.warn(
                name,
                `Could not find sticky header container with selector '${containerSelector}'`
              );
              return Promise.resolve();
            }

            const minVisibleDuration = config.minVisibleDurationMs ?? 0;

            // initialize observer only if fadeOutTrigger is not disabled
            if (config.fadeOutTrigger !== false) {
              const options = config.fadeOutTrigger.options ?? {
                rootMargin: '0px'
              };

              // start observing the first element that matches the selector
              const targets = ctx.window__.document.querySelectorAll(
                config.fadeOutTrigger.selector
              );
              // I don't trust the spread operator [target] = targets. The element is typed as Element without null,
              // but it can be null. So we need to check for null.
              const target = targets.length > 0 ? targets.item(0) : null;

              // optional navbar configuration to support none-sticky navbars
              const navbarConfig = config.navbarConfig;
              const navbarHiddenClass =
                navbarConfig?.navbarHiddenClassName ?? navbarHiddenClassName;
              const navbar = navbarConfig
                ? ctx.window__.document.querySelector(navbarConfig.selector)
                : null;

              if (target) {
                const adRenderResultPromise = adRenderResult(
                  ctx,
                  headerSlot.moliSlot,
                  config.disallowedAdvertiserIds,
                  minVisibleDuration
                );

                // setup intersection observer
                observer = new IntersectionObserver(
                  intersectionObserverFadeOutCallback(
                    container,
                    target,
                    adRenderResultPromise,
                    navbar,
                    navbarHiddenClass,
                    config.fadeOutClassName
                  ),
                  options
                );
                observer.observe(target);

                if (navbar) {
                  observer.observe(navbar);
                }
              } else {
                ctx.logger__.error(
                  name,
                  `No DOM element found for selector ${config.fadeOutTrigger.selector}. Sticky header may never fade out`
                );
              }
            }

            // register close button
            const closeButton =
              ctx.window__.document.querySelector<HTMLButtonElement>(buttonSelector);
            if (closeButton) {
              closeButton.addEventListener('click', () => {
                container.classList.add(config.fadeOutClassName);
                if (observer) {
                  observer.disconnect();
                }
                if (ctx.env__ === 'production') {
                  ctx.window__.googletag.destroySlots([headerSlot.adSlot]);
                }

                // kill it with fire!
                if (config.destroySlot) {
                  if (container) {
                    container.remove();
                  }
                }
              });
            }
            return Promise.resolve();
          })
        ]
      : [];
  };

  return {
    name,
    description: 'sticky header ad creatives',
    moduleType: 'creatives' as ModuleType,
    config__,
    configure__,
    initSteps__,
    configureSteps__,
    prepareRequestAdsSteps__
  };
};
