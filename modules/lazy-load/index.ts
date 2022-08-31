/**
 * Moli's own Lazy Reload solution to lazy loading specific ad slot.
 *
 * This module allows us to configure some slots with lazy loading behaviour, thus refresh adSlot only
 * when the adSlot is intersected (seen) on the viewport.
 *
 * ## Integration
 *
 * In your `index.ts` import the lazy-load module and register it.
 *
 *
 * ```javascript
 * import { LazyLoad } from '@highfivve/module-moli-lazy-load';
 *
 * moli.registerModule(new LazyLoad({
 *   // Provide an array of domIds that should have lazy-loading behaviour,
 *   // and assign desired options to each group of domIds if required.
 *
 *   slots: [
 *     { domIds: ['lazy-loading-adslot-1', 'lazy-loading-adslot-2'], options: {threshold: .5} },
 *     { domIds: ['lazy-loading-adslot-3'], options: {rootMargin: '20px'} }
 *   ],
 *   buckets: []
 * }, window));
 * ```
 *
 * @module
 */
import {IModule, ModuleType, Moli, getLogger} from '@highfivve/ad-tag';
import MoliWindow = Moli.MoliWindow;

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
  readonly domIds: string[];
  readonly options: LazyLoadModuleOptionsType;
};

export type InfiniteSlotsSelector = {
  readonly selector: string;
  readonly options: LazyLoadModuleOptionsType;
};

export type LazyLoadModuleConfig = {
  readonly slots: LazyLoadModulePerKeyConfig[];
  readonly buckets: LazyLoadModulePerKeyConfig[];
  readonly infiniteSlots?: InfiniteSlotsSelector[];
};

/**
 * To solve the Intersection Observer API typescript error
 * @see https://github.com/microsoft/TypeScript/issues/16255
 */
export type LazyLoadWindow = Window &
  MoliWindow & {
  IntersectionObserver: {
    prototype: IntersectionObserver;
    new(
      callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit
    ): IntersectionObserver;
  };
};

/**
 * This module can be used to refresh ads based on slot visibility.
 */
export class LazyLoad implements IModule {
  public readonly name: string = 'moli-lazy-load';
  public readonly description: string = 'Moli implementation of an ad lazy load module.';
  public readonly moduleType: ModuleType = 'lazy-load';
  private logger?: Moli.MoliLogger;
  private window: LazyLoadWindow;

  /**
   * Prevents multiple initialization, which would ap pend multiple googletag event listeners.
   */
  private initialized: boolean = false;

  constructor(
    private readonly moduleConfig: LazyLoadModuleConfig,
    private readonly _window: Window & MoliWindow
  ) {
    // typescript does not yet have the IntersectionObserver on the lib.dom.ts
    // @see https://github.com/Microsoft/TypeScript/issues/16255
    this.window = _window as LazyLoadWindow;
  }

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
    window: LazyLoadWindow
  ) => {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.logger?.debug(this.name, 'initialize moli lazy load module');

    const slotsConfig = lazyModuleConfig.slots;
    const bucketsConfig = lazyModuleConfig.buckets;
    const infiniteSlotsConfig = lazyModuleConfig.infiniteSlots;

    slotsConfig.forEach(config => {
      const observer = new window.IntersectionObserver(
        entries => {
          console.log('lazy-load slots called with', entries);
          entries.forEach((entry: IntersectionObserverEntry) => {
            if (entry.isIntersecting) {
              this.logger?.debug(this.name, `Trigger ad slot with DOM ID ${entry.target.id}`);
              this.window.moli.refreshAdSlot(entry.target.id);
              observer.unobserve(entry.target);
            }
          });
        },
        {
          root: config.options.rootId
            ? window.document.getElementById(config.options.rootId)
            : null,
          threshold: config.options.threshold,
          rootMargin: config.options.rootMargin
        }
      );

      config.domIds.forEach((domId, index) => {
        const slot = moliConfig.slots.find(slot => slot.domId === domId);
        if (!slot) {
          this.logger?.warn(this.name, `Lazy-load non-existing slot with domID ${domId}`);
        } else if (slot.behaviour.loaded !== 'manual') {
          this.logger?.warn(
            this.name,
            `Lazy-load configured for slot without manual loading behaviour. ${domId}`
          );
        } else if (slot.behaviour.loaded === 'manual') {
          const elementToObserve = window.document.querySelector(`#${domId}`);
          elementToObserve && observer.observe(elementToObserve);
        }
      });
    });

    if (infiniteSlotsConfig) {
      infiniteSlotsConfig.forEach((config, index) => {
          const infiniteElements = document.querySelectorAll(config.selector);
          const configuredInfiniteSlot = moliConfig.slots.find(slot => slot.behaviour.loaded === 'infinite');
          if (configuredInfiniteSlot) {
            const observer = new window.IntersectionObserver(
              entries => {
                console.log('called with', entries);
                entries.forEach((entry: IntersectionObserverEntry, index) => {
                  if (entry.isIntersecting) {
                    const slotIndex = Array.from(infiniteElements).findIndex(
                      element => element.id === entry.target.id
                    );
                    const createdDomId = `${configuredInfiniteSlot.domId}-${slotIndex + 1}`;
                    entry.target.setAttribute('id', createdDomId);
                    this.logger?.debug(
                      this.name,
                      `Trigger ad slot with newly created DOM ID ${createdDomId}`
                    );
                    this.window.moli.refreshInfiniteAdSlot(
                      createdDomId,
                      configuredInfiniteSlot.domId,
                      config.selector
                    );
                    observer.unobserve(entry.target);
                  }
                });
              },
              {
                root: config.options.rootId
                  ? window.document.getElementById(config.options.rootId)
                  : null,
                threshold: config.options.threshold,
                rootMargin: config.options.rootMargin
              }
            );

            const elementsToObserve = window.document.querySelectorAll(config.selector);
            elementsToObserve.forEach(element => element && observer.observe(element));
          } else {
            {
              this.logger?.warn(
                this.name,
                `No infinite-scrolling slot configured!`
              )
            }
          }
        }
      );
    } else {
      this.logger?.debug(
        this.name,
        `No CSS selector for infinite-scrolling slots entered`
      )
    }
  };
}
