import { AdPipelineContext, Moli } from '@highfivve/ad-tag';
import { EmetriqModuleConfig } from './index';

const extractAdIdOrIdfa = (
  context: AdPipelineContext,
  moduleConfig: EmetriqModuleConfig
): string | undefined => {
  if (moduleConfig.os === 'web') {
    return;
  }
  const deviceId = context.config.targeting?.keyValues[moduleConfig.advertiserIdKey];
  if (deviceId) {
    return typeof deviceId === 'string' ? deviceId : deviceId[0];
  }
  return;
};
/**
 * Sends a tracking request directly to the emetriq data API.
 * @param context ad pipeline context to retrieve necessary metadata and consent
 * @param moduleConfig provides details for the data call
 * @param fetch used to call the login event endpoint
 * @param logger proper logging support
 *
 * @see https://docs.xdn.emetriq.de/#event-import
 */
export const trackLoginEvent = (
  context: AdPipelineContext,
  moduleConfig: EmetriqModuleConfig,
  fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  logger: Moli.MoliLogger
): Promise<any> => {
  if (!moduleConfig.login) {
    logger.warn('emetriq', 'login configuration missing!');
    return Promise.resolve();
  }

  // use modern URL type
  const url = new URL(`https://xdn-ttp.de/lns/import-event-${moduleConfig.login.partner}`);
  url.searchParams.append('guid', moduleConfig.login.guid);

  // consent parameter
  if (context.tcData.gdprApplies) {
    url.searchParams.append('gdpr', '1');
    url.searchParams.append('gdpr_consent', context.tcData.tcString);
  } else {
    url.searchParams.append('gdpr', '0');
  }

  const adIdOrIdfa = extractAdIdOrIdfa(context, moduleConfig);
  if (adIdOrIdfa) {
    switch (moduleConfig.os) {
      case 'android':
        url.searchParams.append('adid', adIdOrIdfa);
        break;
      case 'ios':
        url.searchParams.append('idfa', adIdOrIdfa);
        break;
    }
  }

  return fetch(url.href).catch(error => logger.error(error));
};
