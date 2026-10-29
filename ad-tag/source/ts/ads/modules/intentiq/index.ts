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
 * With `refreshUserIds: true` the module calls `pbjs.refreshUserIds({ submoduleNames: ['intentIqId'] })`
 * right after the merge. In Prebid.js < 11.40.0 the userId module may already have initialized
 * between the core `setConfig` and this `mergeConfig` (they are separate `pbjs.que` commands), in
 * which case `intentIqId` would never be initialized for the page view. The refresh closes that gap
 * and is a no-op if init hasn't run yet. Prebid.js 11.40.0 fixed this race itself
 * (https://github.com/prebid/Prebid.js/pull/15691). highfivve-portal sets the flag based on the
 * Prebid.js version; the module only follows it.
 *
 * ## IntentIQ Bidders and Manual Win Report
 *
 * highfivve-portal can restrict IntentIQ to a subset of bidders (highfivve-portal ADR 0041). It
 * then emits the **IntentIQ Bidders** as `bidders`:
 *
 * ```json
 * {
 *   "intentiq": {
 *     "enabled": true,
 *     "partner": 123456,
 *     "bidders": ["appnexus", "criteo", "pubmatic"]
 *   }
 * }
 * ```
 *
 * A non-empty `bidders` list turns on, with no other flag:
 *
 * - `bidders` on the `intentIqId` userId entry, so only those bidders receive the IntentIQ EID
 * - `manualWinReportEnabled: true` on the shared config object, so the `iiqAnalytics` adapter
 *   stops reporting wins itself
 * - the **Manual Win Report**: one prebid `bidWon` listener per page (registered together with the
 *   analytics adapter, so not again on SPA navigations) calls
 *   `window.intentIqAnalyticsAdapter_<partner>.reportExternalWin(...)` for wins of the IntentIQ
 *   Bidders only. `biddingPlatformId` is always `1` (prebid), for server-side bids too. If the
 *   adapter's window variable is missing (no consent, or the adapter is not in the Prebid
 *   Distribution) the win is skipped with a debug log.
 *
 * Without `bidders` (or with an empty list) every bidder gets the IntentIQ id and the adapter
 * reports every win itself.
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

/**
 * A non-empty `bidders` list turns on both the restriction of the IntentIQ id and the Manual Win
 * Report. There is no other flag.
 */
const hasIntentIqBidders = (config: modules.intentiq.IntentIqModuleConfig): boolean =>
  !!config.bidders && config.bidders.length > 0;

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
      : {}),
    // the adapter stops reporting wins itself - the module reports them, see `reportWin`
    ...(hasIntentIqBidders(config) ? { manualWinReportEnabled: true } : {})
  });

  /**
   * Manual Win Report: reports a prebid win to IntentIQ if the winning bidder is one of the
   * IntentIQ Bidders. The `iiqAnalytics` adapter defines the window variable when it is enabled -
   * it is missing if prebid's GDPR enforcement blocked the adapter or the Prebid Distribution does
   * not ship it, in which case there is nothing to report to.
   */
  const reportWin = (
    config: modules.intentiq.IntentIqModuleConfig,
    context: AdPipelineContext,
    bid: prebidjs.BidResponse
  ): void => {
    if (!config.bidders?.includes(bid.bidderCode)) {
      return;
    }
    const adapterVariable = `intentIqAnalyticsAdapter_${config.partner}`;
    const adapter = (
      context.window__ as unknown as Partial<
        Record<string, prebidjs.analytics.IIntentIqAnalyticsAdapterGlobal>
      >
    )[adapterVariable];
    if (!adapter) {
      context.logger__.debug('IntentIQ', `no ${adapterVariable} found. Skipping win report`);
      return;
    }
    adapter.reportExternalWin({
      // always prebid - server-side (s2s) bids are prebid wins too, never 4 (Open RTB)
      biddingPlatformId: 1,
      bidderCode: bid.bidderCode,
      prebidAuctionId: bid.auctionId,
      cpm: bid.cpm,
      currency: bid.currency,
      originalCpm: bid.originalCpm,
      originalCurrency: bid.originalCurrency,
      status: bid.status,
      placementId: bid.adUnitCode,
      adType: bid.mediaType
    });
  };

  /** Builds the `intentIqId` userId provider around the shared config object. */
  const mkUserIdProvider = (
    config: modules.intentiq.IntentIqModuleConfig,
    intentIqConfigObject: prebidjs.userSync.IIntentIqConfig
  ): prebidjs.userSync.IIntentIqIdProvider => ({
    name: 'intentIqId',
    // the IntentIQ Bidders include (PBS) bidder aliases, which prebid accepts here as well
    ...(hasIntentIqBidders(config) ? { bidders: config.bidders as prebidjs.BidderCode[] } : {}),
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
        // closes the userId init race of Prebid.js < 11.40.0 - see `IntentIqModuleConfig.refreshUserIds`
        if (config.refreshUserIds) {
          context.window__.pbjs
            .refreshUserIds({ submoduleNames: ['intentIqId'] })
            .catch(error =>
              context.logger__.error('IntentIQ', 'failed to refresh user ids', error)
            );
        }
      }

      if (!analyticsEnabled) {
        analyticsEnabled = true;
        context.window__.pbjs.enableAnalytics([
          { provider: 'iiqAnalytics', options: intentIqConfigObject }
        ]);
        // like the adapter, the win report listener must exist only once per page (SPA)
        if (hasIntentIqBidders(config)) {
          context.window__.pbjs.onEvent('bidWon', bid => reportWin(config, context, bid));
        }
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
