/**
 * # [IntentIQ](https://www.intentiq.com/)
 *
 * IntentIQ is an identity resolution provider. This module configures the
 * [`intentIqId` prebid userId submodule](https://docs.prebid.org/dev-docs/modules/userid-submodules/intentiq.html)
 * and optionally loads IntentIQ's alternative raw CDN tag script.
 *
 * ## Integration
 *
 * In your `index.ts` import intentiq and register the module.
 *
 * ```js
 * import { createIntentIq } from '@highfivve/module-intentiq';
 * moli.registerModule(createIntentIq());
 * ```
 *
 * ```json
 * {
 *   "intentiq": {
 *     "enabled": true,
 *     "partner": 123456,
 *     "gamParameterName": "intent_iq_group"
 *   }
 * }
 * ```
 *
 * ## Prebid configuration
 *
 * The module is the **only** writer of the `intentIqId` userSync entry. The entry is assembled
 * from the module configuration plus values that are only known at runtime (`domainName`,
 * `gamObjectReference`, `region`) and merged into the prebid configuration with
 * `pbjs.mergeConfig`.
 *
 * ## Analytics
 *
 * The `iiqAnalytics` analytics adapter is not part of this module. It is configured in
 * `MoliConfig.prebid.analyticAdapters` and enabled by the generic `pbjs.enableAnalytics` call in
 * the prebid init step.
 *
 * @module
 */
import { IModule, ModuleType } from 'ad-tag/types/module';
import { modules } from 'ad-tag/types/moliConfig';
import { prebidjs } from 'ad-tag/types/prebidjs';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkConfigureStepOncePerRequestAdsCycle,
  mkInitStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { AssetLoadMethod } from 'ad-tag/util/assetLoaderService';

/**
 * IntentIQ's global vendor list id.
 *
 * @see https://vendor-list.consensu.org/v3/vendor-list.json
 */
const gvlid: string = '1323';

const name = 'intentiq';

export const createIntentIq = (): IModule => {
  let intentIqConfig: modules.intentiq.IntentIqModuleConfig | null = null;

  const hasVendorConsent = (context: AdPipelineContext): boolean =>
    !context.tcData__.gdprApplies || Boolean(context.tcData__.vendor.consents[gvlid]);

  /**
   * Loads IntentIQ's alternative raw CDN tag script if one is configured.
   *
   * Prebid's own userId module GDPR enforcement gates the `intentIqId` submodule, but the raw CDN
   * tag is loaded by us, so we check the vendor consent ourselves.
   */
  const loadIntentIqScript = (
    config: modules.intentiq.IntentIqModuleConfig,
    context: AdPipelineContext
  ): Promise<void> => {
    if (context.env__ === 'test' || !config.scriptUrl) {
      return Promise.resolve();
    }

    if (!hasVendorConsent(context)) {
      context.logger__.debug('IntentIQ', 'no vendor consent. Skipping script loading');
      return Promise.resolve();
    }

    return context.assetLoaderService__
      .loadScript({
        name,
        assetUrl: config.scriptUrl,
        loadMethod: AssetLoadMethod.TAG
      })
      .catch(error => context.logger__.error('failed to load intentiq', error));
  };

  /**
   * Builds the `intentIqId` userId provider from the module configuration. `domainName`,
   * `gamObjectReference` and `region` are runtime values and never configurable.
   */
  const mkUserIdProvider = (
    config: modules.intentiq.IntentIqModuleConfig,
    context: AdPipelineContext
  ): prebidjs.userSync.IIntentIqIdProvider => ({
    name: 'intentIqId',
    storage: {
      type: 'html5',
      name: 'intentIqId',
      expires: config.storage?.expires ?? 0,
      refreshInSeconds: config.storage?.refreshInSeconds ?? 0
    },
    params: {
      partner: config.partner,
      region: 'gdpr',
      // the domain ad unit path variable is optional, so there may be no domain to send
      ...(context.adUnitPathVariables__.domain
        ? { domainName: context.adUnitPathVariables__.domain }
        : {}),
      // config field is named browserBlockList (see moliConfig.ts); prebid's own param is
      // browserBlackList - that's IntentIQ's third-party API field name, not ours to rename
      ...(config.browserBlockList ? { browserBlackList: config.browserBlockList } : {}),
      ...(config.abPercentage === undefined ? {} : { abPercentage: config.abPercentage }),
      ...(config.ABTestingConfigurationSource
        ? { ABTestingConfigurationSource: config.ABTestingConfigurationSource }
        : {}),
      ...(config.group ? { group: config.group } : {}),
      // the userId submodule sets the gam targeting key itself, which requires a googletag reference
      ...(config.gamParameterName
        ? {
            gamParameterName: config.gamParameterName,
            gamObjectReference: context.window__.googletag as unknown as Record<string, unknown>
          }
        : {})
    }
  });

  const configureUserId = (
    config: modules.intentiq.IntentIqModuleConfig,
    context: AdPipelineContext
  ): Promise<void> => {
    // without a prebid configuration there's no pbjs instance to configure
    if (context.env__ === 'test' || !context.config__.prebid) {
      return Promise.resolve();
    }

    if (!context.adUnitPathVariables__.domain) {
      context.logger__.warn(
        'IntentIQ',
        'no domain ad unit path variable set. The intentIqId provider will be configured without a domainName'
      );
    }

    context.window__.pbjs.que.push(() => {
      const userIds = context.window__.pbjs.getConfig().userSync?.userIds;
      if (userIds?.some(userId => userId.name === 'intentIqId')) {
        context.logger__.debug('IntentIQ', 'intentIqId userId provider already configured');
        return;
      }

      // mergeConfig appends to the existing `userSync.userIds` array. This is only safe because
      // this module is the single writer of the intentIqId entry.
      context.window__.pbjs.mergeConfig({
        userSync: { userIds: [mkUserIdProvider(config, context)] }
      });
    });

    return Promise.resolve();
  };

  return {
    name,
    configKey: 'intentiq',
    description: 'Configures the IntentIQ prebid userId submodule',
    moduleType: 'identity' as ModuleType,

    config__(): Object | null {
      return intentIqConfig;
    },

    configure__(moduleConfig?: modules.ModulesConfig): void {
      if (moduleConfig?.intentiq && moduleConfig.intentiq.enabled) {
        intentIqConfig = moduleConfig.intentiq;
      }
    },

    initSteps__(): InitStep[] {
      const config = intentIqConfig;
      return config
        ? [
            mkInitStep(name, ctx => {
              // async loading - the userId submodule doesn't depend on this script and prebid
              // takes care of the auction delay
              loadIntentIqScript(config, ctx);
              return Promise.resolve();
            })
          ]
        : [];
    },

    configureSteps__(): ConfigureStep[] {
      const config = intentIqConfig;
      return config
        ? [
            mkConfigureStepOncePerRequestAdsCycle(`${name}-configure`, ctx =>
              configureUserId(config, ctx)
            )
          ]
        : [];
    },

    prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
      return [];
    }
  };
};
