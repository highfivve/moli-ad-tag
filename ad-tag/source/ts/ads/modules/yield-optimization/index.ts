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
import {
  createYieldOptimizationService,
  YieldOptimizationService
} from './yieldOptimizationService';
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
export const YieldOptimization = (
  testYieldOptimizationService?: YieldOptimizationService
): IModule => {
  const name = 'YieldOptimization';
  const description = 'Provides floors and UPR ids';
  const moduleType: ModuleType = 'yield';

  let yieldModuleConfig: modules.yield_optimization.YieldOptimizationConfig | null = null;

  const _initSteps: InitStep[] = [];
  const _prepareRequestAdsSteps: PrepareRequestAdsStep[] = [];

  const config__ = (): Object | null => yieldModuleConfig;

  const configure__ = (moduleConfig?: modules.ModulesConfig): void => {
    if (moduleConfig?.yieldOptimization?.enabled) {
      yieldModuleConfig = moduleConfig.yieldOptimization;

      const yieldOptimizationService =
        testYieldOptimizationService ??
        createYieldOptimizationService(moduleConfig.yieldOptimization);

      _initSteps.push(yieldOptimizationInit(yieldOptimizationService));
      _prepareRequestAdsSteps.push(yieldOptimizationPrepareRequestAds(yieldOptimizationService));
    }
  };

  const initSteps__ = (): InitStep[] => _initSteps;

  const configureSteps__ = (): ConfigureStep[] => [];

  const prepareRequestAdsSteps__ = (): PrepareRequestAdsStep[] => _prepareRequestAdsSteps;

  const yieldOptimizationInit = (yieldOptimizationService: YieldOptimizationService): InitStep =>
    mkInitStep('yield-optimization-init', context => {
      const adUnitPaths = context.config__.slots
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

  const yieldOptimizationPrepareRequestAds = (
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
              yieldModuleConfig,
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

  return {
    name,
    description,
    moduleType,
    config__,
    configure__,
    initSteps__,
    configureSteps__,
    prepareRequestAdsSteps__
  };
};
