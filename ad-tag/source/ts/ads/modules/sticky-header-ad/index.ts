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
 * import { StickyHeaderAd } from '@highfivve/module-sticky-header-ad';
 * moli.registerModule(new StickyHeadersAd);
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
export class StickyHeaderAd implements IModule {
  public readonly name: string = 'sticky-header-ads';
  public readonly description: string = 'sticky header ad creatives';
  public readonly moduleType: ModuleType = 'creatives';

  /**
   * selects the div wrapping the ad slot
   * @private
   */
  private readonly containerSelector = '[data-ref="header-ad"]';

  /**
   * selects the close button of the ad slot
   * @private
   */
  private readonly buttonSelector = '[data-ref="header-ad-close-button"]';

  /**
   * If a none sticky navbar configuration is available, but no css class is configured, this one will
   * be used as default.
   *
   * Overriding this only makes sense if the publisher wants a different class name
   * @private
   */
  private readonly navbarHiddenClassName = '.h5v-header-ad--navbarHidden';

  /**
   * singleton observer instance. Required for SPA publishers where we need to
   * disconnect and reconnect when the user navigates.
   *
   * The instance is also used to ensure that there's only one observer
   * @private
   */
  private observer: IntersectionObserver | null = null;

  private stickyHeaderAdConfig: modules.stickyHeaderAd.StickyHeaderAdConfig | null = null;

  configure(moduleConfig?: modules.ModulesConfig | undefined): void {
    if (moduleConfig?.stickyHeaderAd?.enabled) {
      this.stickyHeaderAdConfig = moduleConfig.stickyHeaderAd;
    }
  }

  config(): Object | null {
    return this.stickyHeaderAdConfig;
  }

  initSteps(): InitStep[] {
    return [];
  }

  configureSteps(): ConfigureStep[] {
    const config = this.stickyHeaderAdConfig;
    return config
      ? [
          mkConfigureStepOncePerRequestAdsCycle('sticky-header-ads:cleanup', () => {
            if (this.observer) {
              this.observer.disconnect();
              this.observer = null;
            }
            return Promise.resolve();
          })
        ]
      : [];
  }

  prepareRequestAdsSteps(): PrepareRequestAdsStep[] {
    const config = this.stickyHeaderAdConfig;
    return config
      ? [
          mkPrepareRequestAdsStep(this.name, LOW_PRIORITY, (ctx, slots) => {
            if (this.observer) {
              return Promise.resolve();
            }

            const headerSlot = slots.find(slot => slot.moliSlot.domId === config.headerAdDomId);
            // the ad pipeline run didn't contain the header slot
            if (!headerSlot) {
              return Promise.resolve();
            }

            const container = ctx.window.document.querySelector<HTMLDivElement>(
              this.containerSelector
            );
            if (!container) {
              ctx.logger.warn(
                this.name,
                `Could not find sticky header container with selector '${this.containerSelector}'`
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
              const targets = ctx.window.document.querySelectorAll(config.fadeOutTrigger.selector);
              // I don't trust the spread operator [target] = targets. The element is typed as Element without null,
              // but it can be null. So we need to check for null.
              const target = targets.length > 0 ? targets.item(0) : null;

              // optional navbar configuration to support none-sticky navbars
              const navbarConfig = config.navbarConfig;
              const navbarHiddenClass =
                navbarConfig?.navbarHiddenClassName ?? this.navbarHiddenClassName;
              const navbar = navbarConfig
                ? ctx.window.document.querySelector(navbarConfig.selector)
                : null;

              if (target) {
                const adRenderResultPromise = adRenderResult(
                  ctx,
                  headerSlot.moliSlot,
                  config.disallowedAdvertiserIds,
                  minVisibleDuration
                );

                // setup intersection observer
                this.observer = new IntersectionObserver(
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
                this.observer.observe(target);

                if (navbar) {
                  this.observer.observe(navbar);
                }
              } else {
                ctx.logger.error(
                  this.name,
                  `No DOM element found for selector ${config.fadeOutTrigger.selector}. Sticky header may never fade out`
                );
              }
            }

            // register close button
            const closeButton = ctx.window.document.querySelector<HTMLButtonElement>(
              this.buttonSelector
            );
            if (closeButton) {
              closeButton.addEventListener('click', () => {
                container.classList.add(config.fadeOutClassName);
                if (this.observer) {
                  this.observer.disconnect();
                }
                if (ctx.env === 'production') {
                  ctx.window.googletag.destroySlots([headerSlot.adSlot]);
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
  }
}
