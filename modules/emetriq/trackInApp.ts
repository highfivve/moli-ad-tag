import { AdPipelineContext, Moli } from '@highfivve/ad-tag';
import { EmetriqAppConfig } from './index';

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
 * @param fetch used to call the data endpoint
 * @param logger required for error logging
 *
 * @see https://doc.emetriq.de/#/inapp/integration
 * @see https://doc.emetriq.de/inapp/api.html#overview
 */
export const trackInApp = (
  context: AdPipelineContext,
  appConfig: EmetriqAppConfig,
  fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  logger: Moli.MoliLogger
): Promise<any> => {
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
  if (appConfig.additionalIdentifier) {
    Object.entries(appConfig.additionalIdentifier).forEach(([key, value]) => {
      additionalIdsParam += `&${key}=${encodeURIComponent(value)}`;
    });
  }

  return fetch(
    `https://aps.xplosion.de/data?sid=${appConfig.sid}${deviceIdParam}&os=${appConfig.os}&app_id=${appConfig.appId}${keywordsParam}${linkParam}${additionalIdsParam}&${consentString}`
  ).catch(error => logger.error(error));
};
