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
 * import { StickyHeaderAds } from '@highfivve/module-sticky-header-ads';
 * moli.registerModule(new StickyHeadersAds({
 *   headerAdDomId: 'ad-header',
 *   fadeOutClassName: 'ad-header--fadeOut',
 *   disallowedAdvertiserIds: [ 111111, 222222 ]
 * }, window));
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
import {
  IAssetLoaderService,
  IModule,
  LOW_PRIORITY,
  mkPrepareRequestAdsStep,
  ModuleType,
  Moli
} from '@highfivve/ad-tag';

/**
 * Configure intersection observer that controls the fade out behaviour
 */
export type StickyHeaderFadeOutConfig = {
  /**
   * The recommendation is to use the first content slot DOM ID as a selector.
   *
   * Other values may be chosen if
   *
   * - no content slots available
   * - hide earlier based on another element
   */
  readonly selector: string;

  /**
   *
   */
  readonly options?: IntersectionObserverInit;
};

export type StickyHeaderAdConfig = {
  /**
   * References the ad slot in the moli config
   */
  readonly headerAdDomId: string;

  /**
   * The class name, which triggers the fade out transition
   */
  readonly fadeOutClassName: string;

  /**
   * By default, the first content position will be used; content_1 if available, or else content_2 and so on.
   * As soon as the ad slot is visible, the header ad slot will receive the `fadeOutClassName` class.
   *
   * Ad tags may customize this:
   *
   * - no content slots available
   * - hide earlier based on another element
   *
   * If `false` is specified, not intersection observer will be registered and the ad slot is always visible.
   * It's only recommended to use this, if there's no mobile sticky ad slot.
   */
  readonly fadeOutTrigger: StickyHeaderFadeOutConfig | false;

  /**
   * Disable rendering the footer ad format for certain advertisers by specifying them here.
   * Most of the time you would use this for partners who ship their own special format or behaviour.
   */
  readonly disallowedAdvertiserIds: number[];
};

/**
 * ## Sticky Headers Ads
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
export class StickyHeaderAds implements IModule {
  public readonly name: string = 'sticky-header-ads';
  public readonly description: string = 'sticky header ad creatives';
  public readonly moduleType: ModuleType = 'creatives';

  /**
   * selects the div wrapping the ad slot
   */
  private readonly containerSelector = '[data-ref="header-ad"]';

  /**
   * selects the close button of the ad slot
   */
  private readonly buttonSelector = '[data-ref="header-ad-close-button"]';

  /**
   * use to ensure only a single initialization
   */
  private initialized: boolean = false;

  constructor(private readonly stickyHeaderAdConfig: StickyHeaderAdConfig) {}

  config(): Object | null {
    return this.stickyHeaderAdConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    // direct prebid events
    // init additional pipeline steps if not already defined
    config.pipeline = config.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    config.pipeline.prepareRequestAdsSteps.push(
      mkPrepareRequestAdsStep(this.name, LOW_PRIORITY, (ctx, slots) => {
        if (this.initialized) {
          return Promise.resolve();
        }

        const headerSlot = slots.find(
          slot => slot.moliSlot.domId === this.stickyHeaderAdConfig.headerAdDomId
        );
        // the ad pipeline run didn't contain the header slot
        if (!headerSlot) {
          return Promise.resolve();
        }

        const container = ctx.window.document.querySelector<HTMLDivElement>(this.containerSelector);
        if (!container) {
          ctx.logger.warn(
            this.name,
            `Could not find sticky header container with selector '${this.containerSelector}'`
          );
          return Promise.resolve();
        }

        // mark as initialized to avoid multiple observer instantiations
        this.initialized = true;

        // initialize observer only if fadeOutTrigger is not disabled
        let observer: IntersectionObserver | null = null;
        if (this.stickyHeaderAdConfig.fadeOutTrigger !== false) {
          const options = this.stickyHeaderAdConfig.fadeOutTrigger.options ?? {
            rootMargin: '0px'
          };

          // setup intersection observer
          // TODO store reference and release when in SPA mode!
          observer = new IntersectionObserver(entries => {
            // only one element will be observed
            const entry = entries[0];
            if (
              // user scrolls down
              entry.isIntersecting ||
              // user starts below observed DOM
              (!entry.isIntersecting && entry.boundingClientRect.y < 0)
            ) {
              container.classList.add(this.stickyHeaderAdConfig.fadeOutClassName);
            } else if (entry.boundingClientRect.y >= 0) {
              container.classList.remove(this.stickyHeaderAdConfig.fadeOutClassName);
            }
          }, options);

          // start observing
          const target = ctx.window.document.querySelector(
            this.stickyHeaderAdConfig.fadeOutTrigger.selector
          );
          if (target) {
            observer.observe(target);
          } else {
            ctx.logger.error(
              this.name,
              `No DOM element found for selector ${this.stickyHeaderAdConfig.fadeOutTrigger.selector}. Sticky header may never fade out`
            );
          }
        }

        // register close button
        const closeButton = ctx.window.document.querySelector<HTMLButtonElement>(
          this.buttonSelector
        );
        if (closeButton) {
          closeButton.addEventListener('click', () => {
            container.classList.add(this.stickyHeaderAdConfig.fadeOutClassName);
            if (observer) {
              observer.disconnect();
            }
            ctx.window.googletag.destroySlots([headerSlot.adSlot]);
          });
        }
        return Promise.resolve();
      })
    );
  }
}
