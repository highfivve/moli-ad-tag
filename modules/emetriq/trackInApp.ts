import { AdPipelineContext, MoliRuntime } from '@highfivve/ad-tag';
import { EmetriqAppConfig } from './index';
import { EmetriqAdditionalIdentifier, EmetriqCustomParams } from './types/emetriq';

const extractDeviceIdParam = (
  context: AdPipelineContext,
  advertiserIdKey: string
): string | undefined => {
  const deviceId = context.config.targeting?.keyValues[advertiserIdKey];
  if (deviceId) {
    return `&device_id=${typeof deviceId === 'string' ? deviceId : deviceId[0]}`;
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
  appConfig: EmetriqAppConfig,
  additionalIdentifier: EmetriqAdditionalIdentifier,
  additionalCustomParams: EmetriqCustomParams,
  document: Document
): void => {
  const deviceIdParam = extractDeviceIdParam(context, appConfig.advertiserIdKey);
  const consentString = context.tcData.gdprApplies
    ? `gdpr=1&gdpr_consent=${context.tcData.tcString}`
    : 'gdpr=0';

  const linkParam = appConfig.linkOrKeyword.link
    ? `&link=${encodeURIComponent(appConfig.linkOrKeyword.link)}`
    : '';
  const keywordsParam = appConfig.linkOrKeyword.keywords
    ? `&keywords=${encodeURIComponent(appConfig.linkOrKeyword.keywords)}`
    : '';

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
