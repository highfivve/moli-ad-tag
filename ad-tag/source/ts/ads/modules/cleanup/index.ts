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
 * Cleans up special formats if enabled (on user navigation and ad reload), especially useful for SPAs.
 *
 * The configs can either provide CSS selectors of the html elements that are part of the special/out-of-page formats and should be deleted
 * or JS as a string that will be evaluated by the module in order to remove these elements.
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
 *         bidder: 'Seedtag',
 *         domId: 'manual-adslot',
 *         deleteMethod: {
 *           cssSelectors: ['.seedtag-container']
 *         }
 *       },
 *       {
 *         bidder: 'Seedtag',
 *         domId: 'lazy-loading-adslot-1',
 *         deleteMethod: {
 *           jsAsString: `window.document.querySelectorAll('.dspx-container').forEach(element => element.remove());`
 *         }
 *       }
 *     }]));
 * ```
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
        try {
          context.logger.debug(
            'Cleanup Module',
            `Try to execute JS string: '${config.deleteMethod.jsAsString}'`
          );
          // eslint-disable-next-line no-eval
          eval(config.deleteMethod.jsAsString);
        } catch (e) {
          context.logger.error(
            'Cleanup Module',
            `Error executing JS string: '${config.deleteMethod.jsAsString}'`,
            e
          );
        }
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
