/**
 * # [Utiq](https://utiq.com/)
 *
 * ## Integration
 *
 * In your `index.ts` import confiant and register the module.
 *
 * ```js
 * import { Utiq } from '@highfivve/module-utiq';
 * moli.registerModule(new Utiq({
 *   assetUrl: 'https://utiq.example.com/utiqLoader.js'
 * }));
 * ```
 *
 * ## Resources
 *
 * - [Utiq docs](https://docs.utiq.com/docs)
 *
 * @module
 */
import { IModule, ModuleType } from 'ad-tag/types/module';
import { tcfapi } from 'ad-tag/types/tcfapi';
import { modules } from 'ad-tag/types/moliConfig';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkInitStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { AssetLoadMethod } from 'ad-tag/util/assetLoaderService';

/**
 * The Utiq API object.
 *
 * NOTE: Only the methods we require in this module are listed here. Checks the docs if you need more and add them accordingly.
 *
 * @see https://docs.utiq.com/docs/api-methods
 */
export interface UtiqAPI {
  /**
   * Displays the Utiq Consent Manager overlay popup. This method operates with the default Utiq consent management setup.
   * Find more details on the []Utiq dedicated consent popup page](https://docs.utiq.com/docs/1b-consent-experience-utiq-separate-pop-up-model-u).
   *
   * @see https://docs.utiq.com/docs/api-methods#APIMethods-showConsentManager
   */
  showConsentManager(): void;
}

export type UtiqWindow = {
  Utiq?: {
    /**
     * The Utiq loader script can be configured using the Utiq.config object. Will be set from the config options provided
     * in the module configuration.
     */
    config?: modules.utiq.UtiqConfigOptions;

    /**
     * public API methods. Only available after the Utiq script is loaded.
     */
    API?: UtiqAPI;
  };
};

/**
 * ## Confiant Ad Fraud Protection
 *
 * Confiant blocks malicious ads.
 *
 */
export class Utiq implements IModule {
  public readonly name: string = 'utiq';
  public readonly description: string = 'user module';
  public readonly moduleType: ModuleType = 'identity';

  private readonly requiredPurposeIds = [
    tcfapi.responses.TCPurpose.STORE_INFORMATION_ON_DEVICE,
    tcfapi.responses.TCPurpose.SELECT_BASIC_ADS,
    tcfapi.responses.TCPurpose.CREATE_PERSONALISED_ADS_PROFILE,
    tcfapi.responses.TCPurpose.SELECT_PERSONALISED_ADS,
    tcfapi.responses.TCPurpose.CREATE_PERSONALISED_CONTENT_PROFILE,
    tcfapi.responses.TCPurpose.SELECT_PERSONALISED_CONTENT,
    tcfapi.responses.TCPurpose.MEASURE_AD_PERFORMANCE,
    tcfapi.responses.TCPurpose.MEASURE_CONTENT_PERFORMANCE,
    tcfapi.responses.TCPurpose.APPLY_MARKET_RESEARCH,
    tcfapi.responses.TCPurpose.DEVELOP_IMPROVE_PRODUCTS,
    tcfapi.responses.TCPurpose.USE_LIMITED_DATA_TO_SElECT_CONTENT
  ];

  private utiqConfig: modules.utiq.UtiqConfig | null = null;

  config(): Object | null {
    return this.utiqConfig;
  }

  configure(moduleConfig?: modules.ModulesConfig) {
    if (moduleConfig?.utiq && moduleConfig.utiq.enabled) {
      this.utiqConfig = moduleConfig.utiq;
    }
  }

  initSteps(): InitStep[] {
    const config = this.utiqConfig;
    return config?.enabled ? [mkInitStep(this.name, ctx => this.loadUtiq(config, ctx))] : [];
  }

  configureSteps(): ConfigureStep[] {
    return [];
  }

  prepareRequestAdsSteps(): PrepareRequestAdsStep[] {
    return [];
  }

  loadUtiq(utiqConfig: modules.utiq.UtiqConfig, context: AdPipelineContext): Promise<void> {
    // test environment doesn't require confiant
    if (context.env === 'test') {
      return Promise.resolve();
    }

    const utiqWindow = context.window as unknown as UtiqWindow;
    // merge any existing object. Existing configurations take precedence.
    utiqWindow.Utiq = utiqWindow.Utiq
      ? { ...utiqWindow.Utiq, config: { ...utiqWindow.Utiq.config, ...utiqConfig.options } }
      : { config: utiqConfig.options };

    // no consent if gdpr applies
    if (
      context.tcData.gdprApplies &&
      // this is only a safeguard to block confiant when checkGVLID is false
      this.requiredPurposeIds.some(
        purposeId => context.tcData.gdprApplies && !context.tcData.purpose.consents[purposeId]
      )
    ) {
      return Promise.resolve();
    }
    return context.assetLoaderService
      .loadScript({
        name: this.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: utiqConfig.assetUrl
      })
      .catch(error => context.logger.error('failed to load utiq', error));
  }
}
