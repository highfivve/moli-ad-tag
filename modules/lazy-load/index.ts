/**
 * Moli's own Lazy Reload solution to lazy loading specific ad slots.
 *
 * ## Integration
 *
 * In your `index.ts`, import AdReload and register the module.
 *
 * ```js
 * import { AdReload } from '@highfivve/module-moli-ad-reload';
 *
 * moli.registerModule(new AdReload({
 *    excludeAdSlotDomIds: [ ... ],
 *    optimizeClsScoreDomIds: [ ... ],
 *    includeAdvertiserIds: [ ... ],
 *    includeOrderIds: [ ... ],
 *    excludeOrderIds: [ ... ],
 *    refreshIntervalMs: 20000,
 *    userActivityLevelControl: { level: 'moderate' }
 *  })
 * );
 *  ```
 *
 * Configure the module with:
 *
 * * the DOM IDs you want to **exclude** from being reloaded
 * * the DOM IDs that have an influence on content positioning, e.g. header or content positions - the module
 *   will make sure that reloading these slots will not negatively impact CLS scores
 * * the order ids ("campaign ids" in Google's terminology) you want to **include** for reloading
 * * the advertiser ids ("company ids" in Google's terminology) you want to **include** for reloading
 * * the order ids ("campaign ids" in Google's terminology) you want to **exclude** from reloading;
 *   this option **overrides the includes**!
 * **[optional]** the refresh interval that the reload module should wait before reloading a slot. The interval
 * specifies the minimum time in which the ad has to be visible before refreshing it.
 * * **[optional]** the strictness of checking user activity. The strictness levels are defined like this:
 *   * strict:
 *     * userActivityDuration: 10 seconds
 *     * userBecomingInactiveDuration: 5 seconds
 *   * moderate:
 *     * userActivityDuration: 12 seconds
 *     * userBecomingInactiveDuration: 8 seconds
 *   * lax:
 *     * userActivityDuration: 15 seconds
 *     * userBecomingInactiveDuration: 12 seconds
 *   * custom:
 *     * userActivityDuration: configurable
 *     * userBecomingInactiveDuration: configurable
 * @module
 */
import {
  IModule,
  ModuleType,
  Moli,
  getLogger
} from '@highfivve/ad-tag';
import MoliWindow = Moli.MoliWindow;
import {mockIntersectionObserver} from "./index.test";

type LazyLoadModuleOptionsType = {
  /**
   * The element that is used as the viewport for checking visibility of the target.
   * Must be the ancestor of the target. Defaults to the browser viewport if not specified or if null.
   */
  readonly rootId?: string;

  /**
   * Margin around the root. Can have values similar to the CSS margin property,
   * e.g. "10px 20px 30px 40px". The values can be percentages.
   * This set of values serves to grow or shrink each side of the root element's bounding box
   * before computing intersections. Defaults to all zeros.
   */
  readonly rootMargin?: string;

  /**
   * Either a single number or an array of numbers which indicate at what percentage
   * of the target's visibility the observer's callback should be executed.
   * If you only want to detect when visibility passes the 50% mark, you can use a value of 0.5.
   * If you want the callback to run every time visibility passes another 25%,
   * you would specify the array [0, 0.25, 0.5, 0.75, 1].
   * The default is 0 (meaning as soon as even one pixel is visible, the callback will be run).
   * A value of 1.0 means that the threshold isn't considered passed until every pixel is visible.
   */
  readonly threshold?: number;

};

export type LazyLoadModulePerKeyConfig = {
  /**
   * DomIds that should be observed for lazy loading
   */
  readonly domIds: Array<string>;
  readonly options: LazyLoadModuleOptionsType;
};

export type LazyLoadModuleConfig = {
  readonly slots: Array<LazyLoadModulePerKeyConfig>;
  readonly buckets: Array<LazyLoadModulePerKeyConfig>;
};

/**
 * This module can be used to refresh ads based on slot visibility.
 */
export class LazyLoad implements IModule {
  public readonly name: string = 'moli-lazy-load';
  public readonly description: string = 'Moli implementation of an ad lazy load module.';
  public readonly moduleType: ModuleType = 'lazy-load';

  private logger?: Moli.MoliLogger;

  /**
   * Prevents multiple initialization, which would ap pend multiple googletag event listeners.
   */
  private initialized: boolean = false;

  constructor(
    private readonly moduleConfig: LazyLoadModuleConfig,
    private readonly window: Window & MoliWindow
  ) {}

  config(): LazyLoadModuleConfig {
    return this.moduleConfig;
  }

  init(moliConfig: Moli.MoliConfig): void {

    this.logger = getLogger(moliConfig, this.window);
    this.initialize(moliConfig, this.moduleConfig, this.window);
  }

  private initialize = (
    moliConfig: Moli.MoliConfig,
    lazyModuleConfig: LazyLoadModuleConfig,
    window: Window & MoliWindow
  ) => {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    this.logger?.debug(this.name, 'initialize moli lazy load module');

    const slotsConfig = lazyModuleConfig.slots;
    const bucketsConfig = lazyModuleConfig.buckets;


    slotsConfig.forEach(config => {

      let observer = null as any;
if(typeof window.document !== undefined) {

   observer = new IntersectionObserver(
    entries => {
      entries.forEach((entry: IntersectionObserverEntry) => {

        if (entry.isIntersecting) {
          console.log("entry: " + entry.target.id);

          this.logger?.debug(this.name, `Trigger ad slot with DOM ID ${entry.target.id}`);
          this.window.moli.refreshAdSlot(entry.target.id);

          observer.unobserve(entry.target);
        }
      });
    },
    {
      root: config.options.rootId ? window.document.getElementById(config.options.rootId) : null,
      threshold: config.options.threshold,
      rootMargin: config.options.rootMargin
    }
  );
}


      config.domIds.forEach(domId => {
        if(moliConfig.slots.some(slot => slot.domId === domId && slot.behaviour.loaded === 'manual')) {
          const elementToObserve = window.document.querySelector(`#${domId}`);
          elementToObserve && observer.observe(elementToObserve);
      }});

    });

  };
}
