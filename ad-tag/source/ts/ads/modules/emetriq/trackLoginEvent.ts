import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import { modules } from 'ad-tag/types/moliConfig';

const extractAdIdOrIdfa = (
  context: AdPipelineContext,
  moduleConfig: modules.emetriq.EmetriqModuleConfig
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
 * Uses the session storage to persist the last time when the user was tracked.
 * @param storage persist last tracking time - sessionStorage is recommended
 * @param currentDate provided via Date.now(), UTC timestamp in milliseconds
 * @param logger log errors
 */
export const shouldTrackLoginEvent = (
  storage: Storage,
  currentDate: number,
  logger: MoliRuntime.MoliLogger
): boolean => {
  try {
    const oneDayMilliseconds = 86400000;
    const key = 'moli_emetriq';
    const value = storage.getItem(key);
    const storedDate = value ? Number.parseInt(value, 10) : 0;

    // if the currentDate - 1 day is smaller than the stored date, the login event should be fired
    // this should ensure that at most once per day an event is fired
    const shouldTrack = currentDate - oneDayMilliseconds > storedDate;

    // reset the track timestamp if
    if (shouldTrack) {
      storage.setItem(key, currentDate.toString());
      logger.debug(
        'emetriq',
        `eligible for login event tracking. Last tracked at ${new Date(storedDate)}`
      );
    }
    return shouldTrack;
  } catch (e) {
    logger.error('emetriq', 'could not access session storage', e);
    return false;
  }
};

/**
 * Sends a tracking request directly to the emetriq data API.
 * @param context ad pipeline context to retrieve necessary metadata and consent
 * @param moduleConfig provides details for the data call
 * @param document insert tracking pixel into this document
 * @param logger proper logging support
 *
 * @see https://docs.xdn.emetriq.de/#event-import
 */
export const trackLoginEvent = (
  context: AdPipelineContext,
  moduleConfig: modules.emetriq.EmetriqModuleConfig,
  document: Document,
  logger: MoliRuntime.MoliLogger
): void => {
  if (!moduleConfig.login) {
    logger.warn('emetriq', 'login configuration missing!');
    return;
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

  // insert tracking pixel
  const pixel = document.createElement('img');
  pixel.src = url.href;
  pixel.width = 1;
  pixel.height = 1;
  document.body.append(pixel);
};
