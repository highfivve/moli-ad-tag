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
 * ## Multiple infinite slots
 *
 * If you have infinite slots with different `pageType` values, you can use this to differentiate between them.
 * Image you have a
 *
 * - `search_content_x` slot
 * - `result_content_x` slot
 *
 * You add a `data-h5-slot-dom-id` attribute to the infinite slot container, which will select the ad slot with this
 * `domId` value from the moli slots.
 *
 * ```html
 * <div class="ad-infinite" data-h5-slot-dom-id="search_content_x"></div>
 * ```
 *
 * If the `data-h5-slot-dom-id` is not provided, the first slot with `loaded: infinite` will be used.
 *
 * @module
 */

import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { modules } from 'ad-tag/types/moliConfig';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  LOW_PRIORITY,
  mkPrepareRequestAdsStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { IModule, ModuleType } from 'ad-tag/types/module';
import { mkConfigureStepOncePerRequestAdsCycle } from 'ad-tag/ads/adPipeline';
import { selectInfiniteSlot } from './selectInfiniteSlot';

/**
 * To solve the Intersection Observer API typescript error
 * @see https://github.com/microsoft/TypeScript/issues/16255
 */
export type LazyLoadWindow = Window &
  MoliRuntime.MoliWindow & {
    IntersectionObserver: {
      prototype: IntersectionObserver;
      new (
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

  /**
   * Prevents multiple initialization, which would ap pend multiple googletag event listeners.
   */
  private initialized: boolean = false;

  /**
   * Preserve observers for garbage collecting in SPA apps
   */
  private readonly observers: IntersectionObserver[] = [];

  private lazyloadConfig: modules.lazyload.LazyLoadModuleConfig | null = null;

  config__(): modules.lazyload.LazyLoadModuleConfig | null {
    return this.lazyloadConfig;
  }

  configure__(moduleConfig?: modules.ModulesConfig): void {
    if (moduleConfig?.lazyload && moduleConfig.lazyload.enabled) {
      this.lazyloadConfig = moduleConfig.lazyload;
    }
  }

  initSteps__(): InitStep[] {
    return [];
  }

  configureSteps__(): ConfigureStep[] {
    const config = this.lazyloadConfig;
    return config
      ? [
          mkConfigureStepOncePerRequestAdsCycle('lazy-module-configuration', context => {
            this.initialized = false;
            // Disconnect all initialized observers at every requestAd(), useful for SPA apps
            this.observers.forEach(observer => observer.disconnect());
            this.observers.length = 0;
            this.registerIntersectionObservers(context, config);
            return Promise.resolve();
          })
        ]
      : [];
  }

  prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
    return [
      // this step is always enabled. It does not need any configuration and is only triggered
      // by external API calls.
      mkPrepareRequestAdsStep('lazy-module-delay', LOW_PRIORITY, (context, slots) => {
        return new Promise((resolve, reject) => {
          const delay = context.options__?.options?.delay;
          if (delay) {
            context.logger__?.debug(this.name, 'delaying slots', slots);
            const delayTrigger = new Promise<boolean>(resolve => {
              context.window__.addEventListener('h5v.trigger-delay', () => resolve(true), {
                once: true
              });
            });
            const timeout = new Promise<boolean>(resolve => {
              context.window__.setTimeout(() => resolve(false), delay.timeoutMs ?? 30000);
            });
            // if the failsafe delay kicks in, we reject the promise and fail the entire ad pipeline
            // this is to prevent the ad pipeline from hanging indefinitely, most likely creating
            // memory leaks
            return Promise.race([delayTrigger, timeout]).then(triggered => {
              return triggered ? resolve() : reject(new Error('Delay timeout exceeded'));
            });
          } else {
            resolve();
          }
        });
      })
    ];
  }

  registerIntersectionObservers = (
    context: AdPipelineContext,
    moduleConfig: modules.lazyload.LazyLoadModuleConfig
  ) => {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    context.logger__?.debug(this.name, 'initialize moli lazy load module');

    const slotsConfig = moduleConfig.slots;
    const bucketsConfig = moduleConfig.buckets;
    const infiniteSlotsConfig = moduleConfig.infiniteSlots;

    const window = context.window__ as unknown as LazyLoadWindow;
    slotsConfig.forEach(config => {
      const observer = new window.IntersectionObserver(
        entries => {
          context.logger__?.debug(this.name, 'lazy-load slots called with', entries);
          entries.forEach((entry: IntersectionObserverEntry) => {
            if (entry.isIntersecting) {
              context.logger__?.debug(this.name, `Trigger ad slot with DOM ID ${entry.target.id}`);
              window.moli.refreshAdSlot(entry.target.id);
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
      this.observers.push(observer);

      config.domIds.forEach(domId => {
        const slot = context.config__.slots.find(slot => slot.domId === domId);
        if (!slot) {
          context.logger__?.warn(this.name, `Lazy-load non-existing slot with domID ${domId}`);
        } else if (slot.behaviour.loaded !== 'manual') {
          context.logger__?.warn(
            this.name,
            `Lazy-load configured for slot without manual loading behaviour. ${domId}`
          );
        } else if (slot.behaviour.loaded === 'manual') {
          const elementToObserve = window.document.getElementById(domId);
          elementToObserve && observer.observe(elementToObserve);
        }
      });
    });

    bucketsConfig.forEach(config => {
      const observer = new window.IntersectionObserver(
        entries => {
          entries.forEach((entry: IntersectionObserverEntry) => {
            if (entry.isIntersecting && entry.target.id === config.observedDomId) {
              // sanity check
              const correspondingBucket = context.config__.slots.find(
                slot => slot.domId === config.observedDomId
              )?.behaviour.bucket;

              if (correspondingBucket !== config.bucket) {
                context.logger__?.warn(
                  this.name,
                  `${config.observedDomId} doesn't belong to ${config.bucket}`
                );
              } else {
                const domIdsInCorrespondingBucket = context.config__.slots
                  .filter(slot => slot.behaviour.bucket === config.bucket)
                  .map(slot => slot.domId);
                context.logger__?.debug(
                  `Refresh ${config.bucket}`,
                  `Trigger ad slots with DOM IDs [${domIdsInCorrespondingBucket.join(', ')}]`
                );
                window.moli.refreshBucket(config.bucket);

                observer.unobserve(entry.target);
              }
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
      this.observers.push(observer);

      if (!context.config__.buckets?.enabled) {
        context.logger__?.warn(this.name, "GlobalBucket config isn't enabled");
      }

      if (!(context.config__.buckets?.bucket && context.config__.buckets.bucket[config.bucket])) {
        context.logger__?.error(
          this.name,
          `Lazy-load non-existing bucket with name ${config.bucket}`
        );
      } else {
        const elementToObserve = window.document.getElementById(config.observedDomId);
        elementToObserve && observer.observe(elementToObserve);
      }
    });

    const { configuredInfiniteSlots, findSlot } = selectInfiniteSlot(context.config__.slots);

    (infiniteSlotsConfig || []).forEach(config => {
      const serialNumberLabel = 'data-h5-serial-number';

      if (configuredInfiniteSlots.length > 0) {
        const observer = new window.IntersectionObserver(
          entries => {
            entries.forEach((entry: IntersectionObserverEntry) => {
              if (entry.isIntersecting) {
                const { configuredInfiniteSlot, configSlotDomId } = findSlot(entry.target);

                if (configuredInfiniteSlot) {
                  const serialNumber =
                    entry.target.attributes?.getNamedItem(serialNumberLabel)?.value;
                  const createdDomId = `${configuredInfiniteSlot.domId}-${serialNumber}`;
                  entry.target.setAttribute('id', createdDomId);
                  context.logger__?.debug(
                    this.name,
                    `Trigger ad slot with newly created DOM ID ${createdDomId}`
                  );
                  window.moli.refreshInfiniteAdSlot(createdDomId, configuredInfiniteSlot.domId);
                  observer.unobserve(entry.target);
                } else {
                  context.logger__?.error(
                    this.name,
                    `No infinite-scrolling slot configured for ${configSlotDomId}`
                  );
                  observer.unobserve(entry.target);
                }
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
        this.observers.push(observer);

        const infiniteElements = window.document.querySelectorAll(config.selector);
        infiniteElements.forEach((element, index) => {
          element.setAttribute(serialNumberLabel, `${index + 1}`);
          element && observer.observe(element);
        });
      } else {
        context.logger__?.warn(this.name, `No infinite-scrolling slots configured!`);
      }
    });
  };
}
