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
import { IModule, ModuleType } from 'ad-tag/types/module';
import { AssetLoadMethod, IAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkInitStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { modules } from 'ad-tag/types/moliConfig';
import ConfiantConfig = modules.confiant.ConfiantConfig;

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

  private confiantConfig: modules.confiant.ConfiantConfig | null = null;

  config(): Object | null {
    return this.confiantConfig;
  }

  configure(moduleConfig?: modules.ModulesConfig) {
    if (moduleConfig?.confiant && moduleConfig.confiant.enabled) {
      this.confiantConfig = moduleConfig.confiant;
    }
  }

  initSteps(assetLoaderService: IAssetLoaderService): InitStep[] {
    const config = this.confiantConfig;
    return config
      ? [mkInitStep('confiant-init', ctx => this.loadConfiant(ctx, assetLoaderService, config))]
      : [];
  }

  loadConfiant(
    context: AdPipelineContext,
    assetLoaderService: IAssetLoaderService,
    config: ConfiantConfig
  ): Promise<void> {
    // test environment doesn't require confiant
    if (context.env === 'test') {
      return Promise.resolve();
    }

    // no consent if gdpr applies
    if (
      context.tcData.gdprApplies &&
      // this is only a safeguard to block confiant when checkGVLID is false
      (!context.tcData.purpose.consents['1'] ||
        // validate the GVL ID if configured
        !(!this.confiantConfig?.checkGVLID || context.tcData.vendor.consents[this.gvlid]))
    ) {
      return Promise.resolve();
    }
    assetLoaderService
      .loadScript({
        name: this.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: config.assetUrl
      })
      .catch(error => context.logger.error('failed to load confiant', error));
    return Promise.resolve();
  }

  configureSteps(): ConfigureStep[] {
    return [];
  }

  prepareRequestAdsSteps(): PrepareRequestAdsStep[] {
    return [];
  }
}
