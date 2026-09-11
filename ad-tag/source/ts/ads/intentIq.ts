import { prebidjs } from 'ad-tag/types/prebidjs';
import { googletag } from 'ad-tag/types/googletag';
import { AdUnitPathVariables } from 'ad-tag/ads/adUnitPath';
import { AssetLoadMethod, IAssetLoaderService } from 'ad-tag/util/assetLoaderService';

const INTENT_IQ_PROVIDER_NAME: prebidjs.userSync.IIntentIqIdProvider['name'] = 'intentIqId';

const isIntentIqIdProvider = (
  idProvider: prebidjs.userSync.UserIdProvider
): idProvider is prebidjs.userSync.IIntentIqIdProvider =>
  idProvider.name === INTENT_IQ_PROVIDER_NAME;

/**
 * Finds the `intentIqId` userId provider config within a list of configured providers.
 *
 * @param userIds - a list of enabled user ID providers
 */
export const findIntentIqIdProvider = (
  userIds?: prebidjs.userSync.UserIdProvider[]
): prebidjs.userSync.IIntentIqIdProvider | undefined => userIds?.find(isIntentIqIdProvider);

/**
 * Iterates over the provided userIds and, if IntentIQ is found, enriches it with runtime values
 * that a hand-written module config cannot know ahead of time:
 *
 * - `params.domainName` is derived from `adUnitPathVariables.domain`
 * - `params.gamObjectReference` is set to `window.googletag` whenever `params.gamParameterName` is
 *   configured
 * - `params.region` is always hardcoded to `'gdpr'`
 * - `storage` always uses `type: 'html5'` / `name: 'intentIqId'`, keeping the configured
 *   `expires`/`refreshInSeconds` (defaulting both to `0` if unset)
 *
 * @param window - the global window, used to inject the `googletag` reference
 * @param adUnitPathVariables - the resolved ad unit path variables, used to derive `domainName`
 * @param userIds - a list of enabled user ID providers
 * @see https://docs.prebid.org/dev-docs/modules/userid-submodules/intentiq.html
 *
 * @returns the provided userIds if intentIqId is not found or userIds is undefined, else an
 *   enriched version of userIds
 */
export const enrichIntentIqId = (
  window: Window & googletag.IGoogleTagWindow,
  adUnitPathVariables: AdUnitPathVariables,
  userIds?: prebidjs.userSync.UserIdProvider[]
): prebidjs.userSync.UserIdProvider[] | undefined => {
  return userIds?.map<prebidjs.userSync.UserIdProvider>(idProvider => {
    if (!isIntentIqIdProvider(idProvider)) {
      return idProvider;
    }

    return {
      ...idProvider,
      storage: {
        type: 'html5',
        name: 'intentIqId',
        expires: idProvider.storage?.expires ?? 0,
        refreshInSeconds: idProvider.storage?.refreshInSeconds ?? 0
      },
      params: {
        ...idProvider.params,
        domainName: adUnitPathVariables.domain,
        region: 'gdpr',
        ...(idProvider.params.gamParameterName
          ? { gamObjectReference: window.googletag as unknown as Record<string, unknown> }
          : {})
      }
    };
  });
};

/**
 * Builds the `iiqAnalytics` prebid analytics adapter configuration from the (enriched) `intentIqId`
 * userId provider config, sharing `partner`, `ABTestingConfigurationSource`, `browserBlackList`,
 * `domainName`, `group`, `abPercentage`, `region` and `gamObjectReference`.
 *
 * @param userIds - a list of enabled user ID providers, ideally already enriched via
 *   {@link enrichIntentIqId} so `domainName`/`gamObjectReference`/`region` are filled in
 * @see https://docs.prebid.org/dev-docs/analytics/intentiq.html
 *
 * @returns the `iiqAnalytics` analytics adapter config, or `undefined` if `intentIqId` is not
 *   configured
 */
export const createIntentIqAnalyticsAdapter = (
  userIds?: prebidjs.userSync.UserIdProvider[]
): prebidjs.analytics.IIntentIqAnalyticsAdapter | undefined => {
  const provider = findIntentIqIdProvider(userIds);
  if (!provider) {
    return undefined;
  }

  return {
    provider: 'iiqAnalytics',
    options: {
      partner: provider.params.partner,
      region: 'gdpr',
      ABTestingConfigurationSource: provider.params.ABTestingConfigurationSource,
      browserBlackList: provider.params.browserBlackList,
      domainName: provider.params.domainName,
      group: provider.params.group,
      abPercentage: provider.params.abPercentage,
      gamObjectReference: provider.params.gamObjectReference
    }
  };
};

/**
 * Loads the optional IntentIQ external CDN script (`params.scriptUrl`) if the `intentIqId`
 * provider is configured and a `scriptUrl` is set. No-op (no error) otherwise.
 *
 * @param assetLoaderService - used to load the external script
 * @param userIds - a list of enabled user ID providers
 */
export const loadIntentIqScript = (
  assetLoaderService: IAssetLoaderService,
  userIds?: prebidjs.userSync.UserIdProvider[]
): void => {
  const scriptUrl = findIntentIqIdProvider(userIds)?.params.scriptUrl;
  if (!scriptUrl) {
    return;
  }

  assetLoaderService.loadScript({
    name: 'intentIq',
    assetUrl: scriptUrl,
    loadMethod: AssetLoadMethod.TAG
  });
};
