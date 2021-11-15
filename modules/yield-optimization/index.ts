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
  IModule,
  ModuleType,
  Moli,
  getLogger,
  IAssetLoaderService,
  AdPipelineContext,
  HIGH_PRIORITY,
  InitStep,
  mkInitStep,
  mkPrepareRequestAdsStep,
  PrepareRequestAdsStep
} from '@highfivve/ad-tag';
import { YieldOptimizationService } from './yieldOptimizationService';
import { uniquePrimitiveFilter } from '@highfivve/ad-tag/source/ts/util/arrayUtils';

export type YieldOptimizationConfigProvider = 'none' | 'static' | 'dynamic';

/**
 * Available options to configure yield optimization
 */
export type YieldOptimizationConfig =
  | NoYieldOptimizationConfig
  | StaticYieldOptimizationConfig
  | DynamicYieldOptimizationConfig;

export type IYieldOptimizationConfig = {
  readonly provider: YieldOptimizationConfigProvider;
};

/**
 * No key values will be applied. The system is inactive.
 */
export type NoYieldOptimizationConfig = IYieldOptimizationConfig & {
  readonly provider: 'none';
};

/**
 * A static configuration for all ad units. This is to emulate server requests
 */
export type StaticYieldOptimizationConfig = IYieldOptimizationConfig & {
  readonly provider: 'static';

  readonly config: AdunitPriceRulesResponse;
};

/**
 * A dynamic configuration
 */
export type DynamicYieldOptimizationConfig = IYieldOptimizationConfig & {
  readonly provider: 'dynamic';

  /**
   * URL to a json config file that contains a list of AdUnitPriceRules.
   */
  readonly configEndpoint: string;

  /**
   * AdUnitPaths that don't need the yield optimization. Add all adUnits that are not configured in the server.
   */
  readonly excludedAdUnitPaths: string[];
};

export type PriceRules = {
  /**
   * The ad unit that is being configured along with a price that was selected from the server
   */
  readonly [adUnitPath: string]: Moli.yield_optimization.PriceRule;
};

/**
 * Response from the yield optimization server
 */
export type AdunitPriceRulesResponse = {
  readonly rules: PriceRules;
  /**
   * the browser that was detected on the backend.
   * @example Chrome
   */
  readonly browser?: string;
};

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

  private log?: Moli.MoliLogger;

  constructor(
    private readonly yieldModuleConfig: YieldOptimizationConfig,
    private readonly window: Window
  ) {}

  config(): Object | null {
    return this.yieldModuleConfig;
  }

  init(moliConfig: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    this.log = getLogger(moliConfig, this.window);

    const yieldOptimizationService = new YieldOptimizationService(
      this.yieldModuleConfig,
      this.log,
      this.window
    );

    // init additional pipeline steps if not already defined
    moliConfig.pipeline = moliConfig.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    // initialize the yield optimization service
    moliConfig.pipeline.initSteps.push(this.yieldOptimizationInit(yieldOptimizationService));

    // set floor price key values
    moliConfig.pipeline.prepareRequestAdsSteps.push(
      this.yieldOptimizationPrepareRequestAds(yieldOptimizationService)
    );
  }

  yieldOptimizationInit = (yieldOptimizationService: YieldOptimizationService): InitStep =>
    mkInitStep('yield-optimization-init', context => {
      const adUnitPaths = context.config.slots
        .filter(uniquePrimitiveFilter)
        // remove ad units that should not be displayed
        .filter(slot => context.labelConfigService.filterSlot(slot))
        .map(slot => slot.adUnitPath);
      return yieldOptimizationService.init(
        context.labelConfigService.getDeviceLabel(),
        context.config.targeting?.adUnitPathVariables || {},
        adUnitPaths
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
      (context: AdPipelineContext, slots: Moli.SlotDefinition[]) => {
        context.logger.debug('YieldOptimizationService', context.requestId, 'applying price rules');
        const slotsWithPriceRule = slots.map(slot => {
          return yieldOptimizationService
            .setTargeting(slot.adSlot)
            .then(priceRule => (slot.priceRule = priceRule));
        });
        return Promise.all(slotsWithPriceRule)
          .then(() => yieldOptimizationService.getBrowser())
          .then(browser => {
            if (context.env === 'production') {
              context.window.googletag.pubads().setTargeting('upr_browser', browser);
            }
          });
      }
    );
}
