import {
  mkPrepareRequestAdsStep,
  PrepareRequestAdsStep,
  HIGH_PRIORITY,
  ConfigureStep,
  mkConfigureStep,
  mkConfigureStepOncePerRequestAdsCycle,
  AdPipelineContext,
  InitStep
} from 'ad-tag/ads/adPipeline';
import { IModule, ModuleType } from 'ad-tag/types/module';
import { modules } from 'ad-tag/types/moliConfig';
import { resolveAdUnitPath } from 'ad-tag/ads/adUnitPath';
import { findGoogletagSlot } from 'ad-tag/ads/findGoogletagSlot';

/**
 * # Cleanup Module
 *
 * Cleans up special formats if enabled (on user navigation and ad reload), especially developed for SPAs.
 *
 * The configs can either provide CSS selectors of the html elements that are part of the special/out-of-page formats and should be deleted
 * or JS as single strings that contain the logic to remove the special format.
 *
 * Please note: if you want to execute more than one statement/line of JS, please provide each line as separate string in the array.
 * Like this we make sure that each line is tried to be executed and if one fails, the next one is still executed.
 * Only global variables can be accessed in the JS strings!
 *
 * ## Integration
 *
 * In your `index.ts` import the Cleanup module and register the module.
 *
 * ```js
 * moli.registerModule(createCleanup());
 * ```
 *
 * ## Dspx Skin
 *
 * The dspx wallpaper can be cleaned as shown in the example above. The `dspx_start_called.dspxPageSkin.unload()` function is called to remove the wallpaper from the page.
 *
 * Dspx itself also sets a global variable `dspx_start_called.counter` on the window object. This variable is used to count the number of times the skin has been loaded.
 * Dspx unloads the skin itself, if the counter holds a value greater than 1 in order to prevent multiple loads on the page.
 *
 * In SPAs, a value greater than 1 can happen as soon as a user navigates to a sub-page where the wallpaper ad slot is available and refreshed.
 * If we try to unload() a second time, the dspx script crashes. Therefore we have to reset the counter to 0 after each clean-up.
 *
 * ```js
 * {
 *   bidder: 'dspx',
 *   domId: 'wallpaper',
 *   deleteMethod: {
 *     jsAsString: [
 *       'window.dspx_start_called && window.dspx_start_called.dspxPageSkin.unload();',
 *       'window.dspx_start_called && (window.dspx_start_called.counter = 0);'
 *     ]
 *   }
 * }
 * ```
 *
 * ## GAM-only formats (no bidder) - e.g. anchor ad slots
 *
 * `bidder` is optional. If omitted, cleanup always runs for that config and skips the
 * "did this bidder win the last auction on this slot" gate - there is no prebid bidder to check,
 * because the format (e.g. a GAM out-of-page anchor slot) is served by GAM itself.
 *
 * The `destroySlot` delete method destroys the googletag slot matching `domId` OR the resolved
 * `adUnitPath` via `googletag.destroySlots()` - out-of-page slots (anchor/interstitial) never get
 * GPT's own element id set to `domId`, so `adUnitPath` is required as a fallback (see
 * `findGoogletagSlot`, the same lookup `bridge.ts` uses). `adUnitPath` may contain the same
 * placeholders as elsewhere (`{device}`, `{channel}`), resolved via `resolveAdUnitPath` and the pipeline's own
 * `adUnitPathVariables__`. It runs in its own dedicated configure step that always executes before
 * `defineSlots`, scoped to the domIds being (re)requested this cycle - so a stale anchor slot from
 * the previous reload never collides with the newly (re)defined one.
 *
 * ```js
 * {
 *   // no bidder - GAM serves this slot directly, not through prebid
 *   domId: 'mobile_stickyad',
 *   deleteMethod: { destroySlot: true, adUnitPath: '/1234567/example/{device}/anchor' }
 * }
 * ```
 *
 * This shape is authored manually per publisher, same as any other cleanup config - the Cleanup
 * Module stays independent of the anchor waterfall feature and is not auto-configured from it.
 *
 */

export interface ICleanupModule extends IModule {
  cleanUp(context: AdPipelineContext, configs: modules.cleanup.CleanupConfig[]): void;
}

export const createCleanup = (): ICleanupModule => {
  const name = 'cleanup';
  let cleanupConfig: modules.cleanup.CleanupModuleConfig | null = null;

  const config__ = (): Object | null => cleanupConfig;

  const configure__ = (modulesConfig?: modules.ModulesConfig) => {
    if (modulesConfig?.cleanup && modulesConfig.cleanup.enabled) {
      cleanupConfig = modulesConfig.cleanup;
    }
  };

  const initSteps__ = (): InitStep[] => [];

  /**
   * Public for testing and spying purposes
   */
  const cleanUp = (context: AdPipelineContext, configs: modules.cleanup.CleanupConfig[]) => {
    configs.forEach(config => {
      if ('cssSelectors' in config.deleteMethod) {
        config.deleteMethod.cssSelectors.forEach((selector: string) => {
          const elements = context.window__.document.querySelectorAll(selector);
          context.logger__.debug(
            'Cleanup Module',
            `Remove elements with selector ${selector} from dom`,
            elements
          );
          elements.forEach((element: Element) => {
            try {
              element.remove();
            } catch (e) {
              context.logger__.error(
                'Cleanup Module',
                `Error removing element with selector ${selector}`,
                e
              );
            }
          });
        });
      } else if ('jsAsString' in config.deleteMethod) {
        config.deleteMethod.jsAsString.forEach(jsLineAsString => {
          try {
            context.logger__.debug(
              'Cleanup Module',
              `Try to execute string as JS: '${jsLineAsString}'`
            );
            const jsFunction = new Function(jsLineAsString);
            jsFunction();
          } catch (e) {
            context.logger__.error(
              'Cleanup Module',
              `Error executing JS string: '${jsLineAsString}'`,
              e
            );
          }
        });
      } else if ('destroySlot' in config.deleteMethod) {
        let resolvedAdUnitPath: string;
        try {
          resolvedAdUnitPath = resolveAdUnitPath(
            config.deleteMethod.adUnitPath,
            context.adUnitPathVariables__
          );
        } catch (e) {
          context.logger__.error(
            'Cleanup Module',
            `failed to resolve adUnitPath '${config.deleteMethod.adUnitPath}' for domId ${config.domId}, skipping`,
            e
          );
          return;
        }

        const googleTagSlot = findGoogletagSlot(
          { domId: config.domId, adUnitPath: resolvedAdUnitPath },
          context.window__.googletag
        );

        if (googleTagSlot) {
          context.logger__.debug(
            'Cleanup Module',
            `destroying stale gam slot for domId ${config.domId}`,
            googleTagSlot
          );
          context.window__.googletag.destroySlots([googleTagSlot]);
        } else {
          context.logger__.debug(
            'Cleanup Module',
            `no gam slot found for domId ${config.domId} / adUnitPath ${resolvedAdUnitPath}, nothing to destroy`
          );
        }
      }
    });
  };

  const hasBidderWonLastAuction = (
    context: AdPipelineContext,
    config: modules.cleanup.CleanupConfig
  ): boolean => {
    // no bidder configured means this format isn't served through prebid (e.g. a GAM-only
    // out-of-page slot) - always clean up, there's no "did this bidder win" gate to apply
    if (!config.bidder) {
      return true;
    }

    // get the all winning bids from PrebidJS and filter for the last winning bid on the configured slot
    const prebidWinningBids = context.window__.pbjs.getAllWinningBids();
    const bidderThatWonLastAuctionOnSlot = prebidWinningBids
      .filter(bid => bid.adUnitCode === config.domId)
      .at(-1)?.bidder;

    // look at the single cleanup config and check if the configured bidder has won the last auction on the configured slot
    return bidderThatWonLastAuctionOnSlot === config.bidder;
  };

  const configureSteps__ = (): ConfigureStep[] => {
    const config = cleanupConfig;
    return config
      ? [
          mkConfigureStepOncePerRequestAdsCycle(
            'destroy-out-of-page-ad-format',
            (context: AdPipelineContext) => {
              if (context.runtimeConfig__.environment === 'test') {
                return Promise.resolve();
              }

              context.window__.pbjs.que.push(() => {
                // check if the bidder in each of the cleanup configs has won the last auction on the configured slot
                // e.g. seedtag is configured on the wallpaper slot, then clean up seedtag if they have won the last auction on the wallpaper slot
                // prevents cleaning on the first page load
                // `destroySlot` configs are handled exclusively by the dedicated
                // 'destroy-stale-gam-slot-before-redefine' step below - excluded here so a
                // bidder-less config isn't destroyed unscoped to the current cycle's slots
                const configsOfDomIdsThatNeedToBeCleaned = config.configs.filter(
                  config =>
                    !('destroySlot' in config.deleteMethod) &&
                    hasBidderWonLastAuction(context, config)
                );
                cleanUp(context, configsOfDomIdsThatNeedToBeCleaned);
              });
              return Promise.resolve();
            }
          ),
          mkConfigureStep('destroy-stale-gam-slot-before-redefine', (context, slots) => {
            if (context.runtimeConfig__.environment === 'test') {
              return Promise.resolve();
            }

            // runs every cycle (not just once per requestAds() call) and before defineSlots, so a
            // stale GAM out-of-page slot (e.g. an anchor ad) is always destroyed before the
            // pipeline redefines it this reload - unconditional, no bidder-won gate applies here
            const domIdsThisCycle = slots.map(slot => slot.domId);
            const configsToDestroy = config.configs.filter(
              config =>
                'destroySlot' in config.deleteMethod && domIdsThisCycle.includes(config.domId)
            );
            cleanUp(context, configsToDestroy);
            return Promise.resolve();
          })
        ]
      : [];
  };

  const prepareRequestAdsSteps__ = (): PrepareRequestAdsStep[] => {
    const config = cleanupConfig;
    return config
      ? [
          mkPrepareRequestAdsStep('cleanup-before-ad-reload', HIGH_PRIORITY, (context, slots) => {
            if (context.runtimeConfig__.environment === 'test') {
              return Promise.resolve();
            }

            context.window__.pbjs.que.push(() => {
              // look at the slots that should be reloaded & check if there is a cleanup config for it
              // if there is, check if the bidder in this config has won the last auction on the slot
              // `destroySlot` configs are excluded - this step runs after `defineSlots`, too late
              // to destroy a stale GAM slot before it's redefined; that's what the dedicated
              // 'destroy-stale-gam-slot-before-redefine' configure step is for
              const configsOfDomIdsThatNeedToBeCleaned = config.configs
                .filter(config => slots.map(slot => slot.moliSlot.domId).includes(config.domId))
                .filter(config => !('destroySlot' in config.deleteMethod))
                .filter(config => hasBidderWonLastAuction(context, config));

              cleanUp(context, configsOfDomIdsThatNeedToBeCleaned);
            });
            return Promise.resolve();
          })
        ]
      : [];
  };

  return {
    name,
    configKey: 'cleanup',
    description: 'cleanup out-of-page formats on navigation or ad-reload',
    moduleType: 'creatives' as ModuleType,
    config__,
    configure__,
    initSteps__,
    configureSteps__,
    prepareRequestAdsSteps__,
    cleanUp
  };
};
