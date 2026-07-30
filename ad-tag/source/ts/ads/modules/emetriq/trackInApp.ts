import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import { googleAdManager, modules } from 'ad-tag/types/moliConfig';
import { EmetriqAdditionalIdentifier, EmetriqCustomParams } from 'ad-tag/types/emetriq';

const extractDeviceIdParam = (
  targeting: googleAdManager.KeyValueMap,
  advertiserIdKey: string
): string => {
  const deviceId = targeting[advertiserIdKey];
  if (deviceId) {
    return `&device_id=${typeof deviceId === 'string' ? deviceId : deviceId[0]}`;
  }
  return '';
};

const extractKeywordsParam = (
  targeting: googleAdManager.KeyValueMap,
  keywordsKey: string | undefined
): string => {
  const keywords = keywordsKey ? targeting[keywordsKey] : undefined;
  if (keywords) {
    const value = typeof keywords === 'string' ? keywords : keywords.join(',');
    return `&keywords=${encodeURIComponent(value)}`;
  }
  return '';
};

/**
 * Sends a tracking request directly to the emetriq data API.
 * @param context ad pipeline context to retrieve necessary metadata and consent
 * @param appConfig provides details for the data call
 * @param additionalIdentifier identifiers derived from an external source such as prebid.js
 * @param additionalCustomParams
 * @param document to insert tracking pixel
 *
 * @see https://doc.emetriq.de/#/inapp/integration
 * @see https://doc.emetriq.de/inapp/api.html#overview
 */
export const trackInApp = (
  context: AdPipelineContext,
  appConfig: modules.emetriq.EmetriqAppConfig,
  additionalIdentifier: EmetriqAdditionalIdentifier,
  additionalCustomParams: EmetriqCustomParams,
  document: Document
): void => {
  // merged targeting: runtime key-values (e.g. an `advertising_id` set via `setTargeting` from an
  // app webview) take precedence over static config key-values.
  const targeting = {
    ...context.config__.targeting?.keyValues,
    ...context.runtimeConfig__.keyValues
  };

  const deviceIdParam = extractDeviceIdParam(targeting, appConfig.advertiserIdKey);
  const consentString = context.tcData__.gdprApplies
    ? `gdpr=1&gdpr_consent=${context.tcData__.tcString}`
    : 'gdpr=0';

  // the app pixel always tracks the current page URL; a static config cannot carry it.
  const linkParam = `&link=${encodeURIComponent(context.window__.location.href)}`;
  const keywordsParam = extractKeywordsParam(targeting, appConfig.keywordsKey);

  let additionalIdsParam = '';
  const identifiers = { ...appConfig.additionalIdentifier, ...additionalIdentifier };
  Object.entries(identifiers).forEach(([key, value]) => {
    additionalIdsParam += `&${key}=${encodeURIComponent(value)}`;
  });

  let additionalCustomParam = '';
  const customParams = { ...appConfig.customKeywords, ...additionalCustomParams };
  Object.entries(customParams).forEach(([key, value]) => {
    additionalCustomParam += `&${key}=${encodeURIComponent(value)}`;
  });

  // insert tracking pixel
  const pixel = document.createElement('img');
  pixel.src = `https://aps.xplosion.de/data?sid=${appConfig.sid}${deviceIdParam}&os=${appConfig.os}&app_id=${appConfig.appId}${keywordsParam}${linkParam}${additionalIdsParam}${additionalCustomParam}&${consentString}`;
  pixel.width = 1;
  pixel.height = 1;
  document.body.append(pixel);
};
