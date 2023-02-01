/**
 * # [Confiant](https://www.confiant.com/)
 *
 * Confiant is an ad fraud detection and blocking solution. It supports gpt and prebid.
 *
 * ## Integration
 *
 * In your `index.ts` import confiant and register the module.
 *
 * ```js
 * import { Confiant } from '@highfivve/module-confiant';
 * moli.registerModule(new Confiant({
 *   assetUrl: 'https://confiant-integrations.global.ssl.fastly.net/yqnNhQYNEfv8ldKXnwevFDx_IRM/gpt_and_prebid/config.js'
 * }));
 * ```
 *
 * ### Alternative integration
 *
 * A publisher can also decided to integrated it directly in the head with
 *
 * ```html
 * <head>
 *     <script async src="https://confiant-integrations.global.ssl.fastly.net/yqnNhQYNEfv8ldKXnwevFDx_IRM/gpt_and_prebid/config.js"></script>
 * </head>
 * ```
 *
 * ## Resources
 *
 * - [Confiant Dashboard](https://app.confiant.com/)
 *
 * @module
 */
import {
  Moli,
  IModule,
  ModuleType,
  AssetLoadMethod,
  IAssetLoaderService,
  mkInitStep,
  AdPipelineContext
} from '@highfivve/ad-tag';

export type ConfiantConfig = {
  /**
   * Confiant loads a single javascript file that contains all the configuration properties
   */
  readonly assetUrl: string;
};

/**
 * ## Confiant Ad Fraud Protection
 *
 * Confiant blocks malicious ads.
 *
 */
export class Confiant implements IModule {
  public readonly name: string = 'confiant';
  public readonly description: string = 'ad fraud detection and protection module';
  public readonly moduleType: ModuleType = 'ad-fraud';

  private readonly gvlid: string = '56';

  constructor(private readonly confiantConfig: ConfiantConfig) {}

  config(): Object | null {
    return this.confiantConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    // init additional pipeline steps if not already defined
    config.pipeline = config.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    config.pipeline.initSteps.push(
      mkInitStep(this.name, ctx => this.loadConfiant(ctx, assetLoaderService))
    );
  }

  loadConfiant(context: AdPipelineContext, assetLoaderService: IAssetLoaderService): Promise<void> {
    // test environment doesn't require confiant
    if (context.env === 'test') {
      return Promise.resolve();
    }

    // no consent
    if (context.tcData.gdprApplies && !context.tcData.vendor.consents[this.gvlid]) {
      return Promise.resolve();
    }
    assetLoaderService.loadScript({
      name: this.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: this.confiantConfig.assetUrl
    });
    return Promise.resolve();
  }
}
