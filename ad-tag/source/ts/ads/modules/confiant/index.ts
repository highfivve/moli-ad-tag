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
import { AssetLoadMethod } from 'ad-tag/util/assetLoaderService';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkInitStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { modules } from 'ad-tag/types/moliConfig';

/**
 * ## Confiant Ad Fraud Protection
 *
 * Confiant blocks malicious ads.
 *
 */
export const createConfiant = (): IModule => {
  const name = 'confiant';
  const gvlid: string = '56';
  let confiantConfig: modules.confiant.ConfiantConfig | null = null;

  const config__ = (): Object | null => confiantConfig;

  const configure__ = (moduleConfig?: modules.ModulesConfig) => {
    if (moduleConfig?.confiant && moduleConfig.confiant.enabled) {
      confiantConfig = moduleConfig.confiant;
    }
  };

  const loadConfiant = (
    context: AdPipelineContext,
    config: modules.confiant.ConfiantConfig
  ): Promise<void> => {
    // test environment doesn't require confiant
    if (context.env__ === 'test') {
      return Promise.resolve();
    }

    // no consent if gdpr applies
    if (
      context.tcData__.gdprApplies &&
      // this is only a safeguard to block confiant when checkGVLID is false
      (!context.tcData__.purpose.consents['1'] ||
        // validate the GVL ID if configured
        !(!confiantConfig?.checkGVLID || context.tcData__.vendor.consents[gvlid]))
    ) {
      return Promise.resolve();
    }
    context.assetLoaderService__
      .loadScript({
        name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: config.assetUrl
      })
      .catch(error => context.logger__.error('failed to load confiant', error));
    return Promise.resolve();
  };

  const initSteps__ = (): InitStep[] => {
    const config = confiantConfig;
    return config ? [mkInitStep('confiant-init', ctx => loadConfiant(ctx, config))] : [];
  };

  const configureSteps__ = (): ConfigureStep[] => [];
  const prepareRequestAdsSteps__ = (): PrepareRequestAdsStep[] => [];

  return {
    name,
    description: 'ad fraud detection and protection module',
    moduleType: 'ad-fraud' as ModuleType,
    config__,
    configure__,
    initSteps__,
    configureSteps__,
    prepareRequestAdsSteps__
  };
};