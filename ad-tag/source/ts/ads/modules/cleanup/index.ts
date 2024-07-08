import {
  mkPrepareRequestAdsStep,
  PrepareRequestAdsStep,
  HIGH_PRIORITY,
  ConfigureStep,
  mkConfigureStepOncePerRequestAdsCycle,
  AdPipelineContext
} from '../../adPipeline';
import { Moli } from '../../../types/moli';
import { IModule, ModuleType } from '../../../types/module';

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
 * moli.registerModule(new CleanupModule({
 *     enabled: true,
 *     configs: [
 *       {
 *         bidder: 'seedtag',
 *         domId: 'wallpaper-pixel',
 *         deleteMethod: {
 *           cssSelectors: ['div[data-seedtag-format="inscreen"]']
 *         }
 *       },
 *       {
 *         bidder: 'dspx',
 *         domId: 'lazy-loading-adslot-1',
 *         deleteMethod: {
 *           jsAsString: ['window.dspx_start_called.dspxPageSkin.unload();', 'window.dspx_start_called.counter = 0;']
 *         }
 *       }
 *     }]));
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

export class Cleanup implements IModule {
  public readonly name: string = 'cleanup';
  public readonly description: string = 'cleanup out-of-page formats on navigation or ad-reload';
  public readonly moduleType: ModuleType = 'creatives';

  constructor(private readonly cleanupModuleConfig: Moli.modules.CleanupModuleConfig) {}

  config(): Object | null {
    return this.cleanupModuleConfig;
  }

  init(config: Moli.MoliConfig) {
    if (this.cleanupModuleConfig && this.cleanupModuleConfig.enabled) {
      // init additional pipeline steps if not already defined
      config.pipeline = config.pipeline || {
        initSteps: [],
        configureSteps: [],
        prepareRequestAdsSteps: []
      };

      if (config.spa?.enabled) {
        config.pipeline.configureSteps.push(
          this.destroyAllOutOfPageAdFormats(this.cleanupModuleConfig)
        );
      }

      config.pipeline.prepareRequestAdsSteps.push(
        this.destroySpecialFormatOfReloadedSlot(this.cleanupModuleConfig)
      );
    }
  }

  private cleanUp = (context: AdPipelineContext, configs: Moli.CleanupConfig[]) => {
    configs.forEach(config => {
      if ('cssSelectors' in config.deleteMethod) {
        config.deleteMethod.cssSelectors.forEach((selector: string) => {
          const elements = context.window.document.querySelectorAll(selector);
          context.logger.debug(
            'Cleanup Module',
            `Remove elements with selector ${selector} from dom`,
            elements
          );
          elements.forEach((element: Element) => {
            try {
              element.remove();
            } catch (e) {
              context.logger.error(
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
            context.logger.debug(
              'Cleanup Module',
              `Try to execute string as JS: '${jsLineAsString}'`
            );
            const jsFunction = new Function(jsLineAsString);
            jsFunction();
          } catch (e) {
            context.logger.error(
              'Cleanup Module',
              `Error executing JS string: '${jsLineAsString}'`,
              e
            );
          }
        });
      }
    });
  };

  private destroyAllOutOfPageAdFormats = (
    cleanupConfig: Moli.modules.CleanupModuleConfig
  ): ConfigureStep =>
    mkConfigureStepOncePerRequestAdsCycle(
      'destroy-out-of-page-ad-format',
      (context: AdPipelineContext) => {
        this.cleanUp(context, cleanupConfig?.configs);
        return Promise.resolve();
      }
    );

  private hasBidderWonLastAuction = (
    context: AdPipelineContext,
    config: Moli.CleanupConfig
  ): boolean => {
    const prebidWinningBids = context.window.pbjs.getAllWinningBids();
    const bidderThatWonLastAuctionOnSlot = prebidWinningBids.find(
      bid => bid.adUnitCode === config.domId
    )?.bidder;
    // look at the single cleanup config and check if the configured bidder has won the last auction on the configured slot
    return bidderThatWonLastAuctionOnSlot === config.bidder;
  };

  private destroySpecialFormatOfReloadedSlot = (
    config: Moli.modules.CleanupModuleConfig
  ): PrepareRequestAdsStep =>
    mkPrepareRequestAdsStep('cleanup-before-ad-reload', HIGH_PRIORITY, (context, slots) => {
      const configsOfDomIdsThatNeedToBeCleaned = config.configs
        .filter(config => slots.map(slot => slot.moliSlot.domId).includes(config.domId))
        .filter(config => this.hasBidderWonLastAuction(context, config));

      this.cleanUp(context, configsOfDomIdsThatNeedToBeCleaned);

      return Promise.resolve();
    });
}
