import {
  IModule,
  ModuleType,
  Moli,
  getLogger,
  IAssetLoaderService, PrepareRequestAdsStep, mkPrepareRequestAdsStep, HIGH_PRIORITY, AdPipelineContext
} from '@highfivve/ad-tag';
import { YieldOptimizationService } from './yieldOptimizationService';

export type YieldOptimizationConfigProvider = 'none' | 'static' | 'dynamic';

/**
 * Available options to configure yield optimization
 */
export type YieldOptimizationConfig =
  | INoYieldOptimizationConfig
  | IStaticYieldOptimizationConfig
  | IDynamicYieldOptimizationConfig;

export interface IYieldOptimizationConfig {
  readonly provider: YieldOptimizationConfigProvider;
}

/**
 * No key values will be applied. The system is inactive.
 */
export interface INoYieldOptimizationConfig extends IYieldOptimizationConfig {
  readonly provider: 'none';
}

/**
 * A static configuration for all ad units. This is to emulate server requests
 */
export interface IStaticYieldOptimizationConfig extends IYieldOptimizationConfig {
  readonly provider: 'static';

  readonly config: IAdunitPriceRulesResponse;
}

/**
 * A dynamic configuration
 */
export interface IDynamicYieldOptimizationConfig extends IYieldOptimizationConfig {
  readonly provider: 'dynamic';

  /**
   * URL to a json config file that contains a list of AdUnitPriceRules.
   */
  readonly configEndpoint: string;
}

export type PriceRules = {
  /**
   * The ad unit that is being configured along with a price that was selected from the server
   */
  readonly [adUnitDomId: string]: Moli.yield_optimization.PriceRule
};

/**
 * Response from the yield optimization server
 */
export interface IAdunitPriceRulesResponse {
  readonly rules: PriceRules;
}


/**
 * == Yield Optimization ==
 *
 * The systems is designed to work with Google Ad Managers _Unified Pricing Rules_. The general idea is that
 * key values are being used to target specific pricing rules per ad unit. The configuration when a pricing rule
 * should be applied can be fetched from an external system to allow dynamic floor price optimizations.
 *
 * @see https://support.google.com/admanager/answer/9298008?hl=en
 */
export default class YieldOptimization implements IModule {
  public readonly name: string = 'YieldOptimization';
  public readonly description: string = 'Provides floors and UPR ids';
  public readonly moduleType: ModuleType = 'yield';

  private log?: Moli.MoliLogger;

  constructor(
    private readonly yieldModuleConfig: YieldOptimizationConfig,
    private readonly window: Window
  ) {
  }

  config(): Object | null {
    return this.yieldModuleConfig;
  }


  init(moliConfig: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    this.log = getLogger(moliConfig, this.window);

    // init additional pipeline steps if not already defined
    moliConfig.pipeline = moliConfig.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    const labels = moliConfig.targeting?.labels || [];

    const yieldOptimizationService = new YieldOptimizationService(this.yieldModuleConfig, labels, this.log, this.window);

    moliConfig.pipeline.prepareRequestAdsSteps.push(this.yieldOptimizationPrepareRequestAds(yieldOptimizationService));


  }

  /**
   * This step adds a `priceRule` to the slot definition if possible. It does so by **mutating**
   * the slot definition.
   *
   * @param yieldOptimizationService
   */
  private yieldOptimizationPrepareRequestAds = (
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
        return Promise.all(slotsWithPriceRule);
      }
    );

}
