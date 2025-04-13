/**
 * # Yield Optimization
 *
 * This module allows you to apply floor prices to all supporting bidders and setting
 * a unified pricing rule for GAM.
 *
 * ## Requirements
 *
 * - Unified pricing rules setup in GAM
 * - Server providing the yield configuration
 *
 * ## Integration
 *
 * In your `index.ts` import the generic-skin module and register it.
 *
 * ### Dynamic optimization
 *
 * This requires an endpoint that provides the yield config.
 *
 * ```javascript
 * import { YieldOptimization } from '@highfivve/module-yield-optimization'
 *
 * moli.registerModule(new YieldOptimization({
 *   provider: 'dynamic',
 *   configEndpoint: 'https://yield.h5v.eu/config/gutefrage'
 * }, window));
 * ```
 *
 * ### Static
 *
 * For local testing or base settings you can define static rules.
 *
 * ```javascript
 * import { YieldOptimization } from '@highfivve/module-yield-optimization'
 *
 * moli.registerModule(new YieldOptimization({
 *   provider: 'static',
 *   config: {
 *     rules: {
 *       'ad-unit-dom-id-1': {
 *         priceRuleId: 123,
 *         floorpirce: 0.1,
 *         main: true
 *       }
 *     }
 *   }
 * }, window));
 * ```
 *
 * ### None
 *
 * If you want to turn off the optimization you can also provide `none`
 *
 * ```javascript
 * import { YieldOptimization } from '@highfivve/module-yield-optimization'
 *
 * moli.registerModule(new YieldOptimization({  provider: 'none'}, window));
 * ```
 * @module
 */
import { YieldOptimizationService } from './yieldOptimizationService';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { IModule, ModuleType } from 'ad-tag/types/module';
import { modules } from 'ad-tag/types/moliConfig';
import {
  AdPipelineContext,
  ConfigureStep,
  HIGH_PRIORITY,
  InitStep,
  mkInitStep,
  mkPrepareRequestAdsStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { uniquePrimitiveFilter } from 'ad-tag/util/arrayUtils';

/**
 * == Yield Optimization ==
 *
 * The systems is designed to work with Google Ad Managers _Unified Pricing Rules_. The general idea is that
 * key values are being used to target specific pricing rules per ad unit. The configuration when a pricing rule
 * should be applied can be fetched from an external system to allow dynamic floor price optimizations.
 *
 * @see https://support.google.com/admanager/answer/9298008?hl=en
 */
export class YieldOptimization implements IModule {
  public readonly name: string = 'YieldOptimization';
  public readonly description: string = 'Provides floors and UPR ids';
  public readonly moduleType: ModuleType = 'yield';

  private yieldModuleConfig: modules.yield_optimization.YieldOptimizationConfig | null = null;

  private _initSteps: InitStep[] = [];
  private _prepareRequestAdsSteps: PrepareRequestAdsStep[] = [];

  config__(): Object | null {
    return this.yieldModuleConfig;
  }

  configure__(moduleConfig?: modules.ModulesConfig): void {
    if (moduleConfig?.yieldOptimization?.enabled) {
      this.yieldModuleConfig = moduleConfig.yieldOptimization;

      const yieldOptimizationService = new YieldOptimizationService(moduleConfig.yieldOptimization);

      this._initSteps.push(this.yieldOptimizationInit(yieldOptimizationService));
      this._prepareRequestAdsSteps.push(
        this.yieldOptimizationPrepareRequestAds(yieldOptimizationService)
      );
    }
  }

  initSteps__(): InitStep[] {
    return this._initSteps;
  }

  configureSteps__(): ConfigureStep[] {
    return [];
  }

  prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
    return this._prepareRequestAdsSteps;
  }

  yieldOptimizationInit = (yieldOptimizationService: YieldOptimizationService): InitStep =>
    mkInitStep('yield-optimization-init', context => {
      const adUnitPaths = context.config__.slots
        // remove ad units that should not be displayed
        .filter(slot => context.labelConfigService__.filterSlot(slot))
        .map(slot => slot.adUnitPath)
        .filter(uniquePrimitiveFilter);
      return yieldOptimizationService.init(
        context.labelConfigService__.getDeviceLabel(),
        context.adUnitPathVariables__,
        adUnitPaths,
        context.window__.fetch,
        context.logger__
      );
    });

  /**
   * This step adds a `priceRule` to the slot definition if possible. It does so by **mutating**
   * the slot definition.
   *
   * @param yieldOptimizationService
   */
  yieldOptimizationPrepareRequestAds = (
    yieldOptimizationService: YieldOptimizationService
  ): PrepareRequestAdsStep =>
    mkPrepareRequestAdsStep(
      'yield-optimization',
      HIGH_PRIORITY,
      (context: AdPipelineContext, slots: MoliRuntime.SlotDefinition[]) => {
        context.logger__.debug(
          'YieldOptimizationService',
          context.requestId__,
          'applying price rules'
        );
        const adServer = context.config__.adServer || 'gam';
        const slotsWithPriceRule = slots.map(slot => {
          return yieldOptimizationService
            .setTargeting(
              slot.adSlot,
              adServer,
              context.logger__,
              this.yieldModuleConfig,
              context.auction__
            )
            .then(priceRule => (slot.priceRule = priceRule));
        });
        return Promise.all(slotsWithPriceRule)
          .then(() => yieldOptimizationService.getBrowser())
          .then(browser => {
            if (context.env__ === 'production' && adServer === 'gam') {
              context.window__.googletag.pubads().setTargeting('upr_browser', browser);
            }
          });
      }
    );
}
