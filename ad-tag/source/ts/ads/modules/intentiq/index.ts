/**
 * # [IntentIQ](https://www.intentiq.com/)
 *
 * IntentIQ is an identity resolution provider. This module configures the
 * [`intentIqId` prebid userId submodule](https://docs.prebid.org/dev-docs/modules/userid-submodules/intentiq.html),
 * enables the [`iiqAnalytics` analytics adapter](https://docs.prebid.org/dev-docs/analytics/intentiq.html)
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
 * IntentIQ requires that the userId submodule and the analytics adapter are configured with the
 * **same** object - the analytics adapter reads the A/B group and first-party data the userId
 * submodule stored. So the module builds one `prebidjs.userSync.IIntentIqConfig` from the module
 * configuration plus values that are only known at runtime (`domainName`, `gamObjectReference`,
 * `region`) and passes that one object to both.
 *
 * The module is the **only** writer of the `intentIqId` userSync entry, which it merges into the
 * prebid configuration with `pbjs.mergeConfig`, and the only writer of the `iiqAnalytics` adapter,
 * which it enables with `pbjs.enableAnalytics`. Neither is authored in `MoliConfig`.
 *
 * Right after the merge the module calls `pbjs.refreshUserIds({ submoduleNames: ['intentIqId'] })`.
 * Prebid's userId module may already have initialized between the core `setConfig` and this
 * `mergeConfig` (they are separate `pbjs.que` commands), in which case `intentIqId` would never be
 * initialized for the page view. The refresh closes that gap and is a no-op if init hasn't run yet.
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

  /**
   * `pbjs.enableAnalytics` has no "already enabled" check - calling it twice creates a second
   * `iiqAnalytics` adapter instance that reports every auction a second time. The configure step
   * runs once per requestAds cycle (SPA), so we keep enabling to the first cycle ourselves.
   */
  let analyticsEnabled: boolean = false;

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
   * Builds the single IntentIQ config object shared by the `intentIqId` userId submodule and the
   * `iiqAnalytics` adapter. `domainName`, `gamObjectReference` and `region` are runtime values and
   * never configurable.
   */
  const mkIntentIqConfig = (
    config: modules.intentiq.IntentIqModuleConfig,
    context: AdPipelineContext
  ): prebidjs.userSync.IIntentIqConfig => ({
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
  });

  /** Builds the `intentIqId` userId provider around the shared config object. */
  const mkUserIdProvider = (
    config: modules.intentiq.IntentIqModuleConfig,
    intentIqConfigObject: prebidjs.userSync.IIntentIqConfig
  ): prebidjs.userSync.IIntentIqIdProvider => ({
    name: 'intentIqId',
    storage: {
      type: 'html5',
      name: 'intentIqId',
      expires: config.storage?.expires ?? 0,
      refreshInSeconds: config.storage?.refreshInSeconds ?? 0
    },
    params: intentIqConfigObject
  });

  const configurePrebid = (
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
        'no domain ad unit path variable set. IntentIQ will be configured without a domainName'
      );
    }

    // one object for both integration points - see the module documentation
    const intentIqConfigObject = mkIntentIqConfig(config, context);

    context.window__.pbjs.que.push(() => {
      const userIds = context.window__.pbjs.getConfig().userSync?.userIds;
      if (userIds?.some(userId => userId.name === 'intentIqId')) {
        context.logger__.debug('IntentIQ', 'intentIqId userId provider already configured');
      } else {
        // mergeConfig appends to the existing `userSync.userIds` array. This is only safe because
        // this module is the single writer of the intentIqId entry.
        context.window__.pbjs.mergeConfig({
          userSync: { userIds: [mkUserIdProvider(config, intentIqConfigObject)] }
        });
        // prebid's userId module initializes as soon as `setConfig` (prebid.ts) delivers the
        // userIds, and that runs in a separate que command. With consent already resolved, init can
        // run before this merge and never picks up intentIqId. The refresh initializes just
        // intentIqId in that case, and is a no-op if userId init hasn't run yet.
        context.window__.pbjs
          .refreshUserIds({ submoduleNames: ['intentIqId'] })
          .catch(error => context.logger__.error('IntentIQ', 'failed to refresh user ids', error));
      }

      if (!analyticsEnabled) {
        analyticsEnabled = true;
        context.window__.pbjs.enableAnalytics([
          { provider: 'iiqAnalytics', options: intentIqConfigObject }
        ]);
      }
    });

    return Promise.resolve();
  };

  return {
    name,
    configKey: 'intentiq',
    description: 'Configures the IntentIQ prebid userId submodule and analytics adapter',
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
              configurePrebid(config, ctx)
            )
          ]
        : [];
    },

    prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
      return [];
    }
  };
};
