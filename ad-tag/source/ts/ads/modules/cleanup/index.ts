import {
  mkPrepareRequestAdsStep,
  PrepareRequestAdsStep,
  HIGH_PRIORITY,
  ConfigureStep,
  mkConfigureStepOncePerRequestAdsCycle,
  AdPipelineContext,
  InitStep
} from 'ad-tag/ads/adPipeline';
import { IModule, ModuleType } from 'ad-tag/types/module';
import { modules } from 'ad-tag/types/moliConfig';

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
      } else {
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
      }
    });
  };

  const hasBidderWonLastAuction = (
    context: AdPipelineContext,
    config: modules.cleanup.CleanupConfig
  ): boolean => {
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
                const configsOfDomIdsThatNeedToBeCleaned = config.configs.filter(config =>
                  hasBidderWonLastAuction(context, config)
                );
                cleanUp(context, configsOfDomIdsThatNeedToBeCleaned);
              });
              return Promise.resolve();
            }
          )
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
              const configsOfDomIdsThatNeedToBeCleaned = config.configs
                .filter(config => slots.map(slot => slot.moliSlot.domId).includes(config.domId))
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
