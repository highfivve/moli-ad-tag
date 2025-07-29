/**
 * Extracts the position from a Google Ads iframe path.
 *
 * Example path: google_ads_iframe_/33559401,22222222/example-publisher/ep_mobile_stickyad/mobile/example.net_0__container__
 * Result: 33559401,22222222/example-publisher/ep_mobile_stickyad/mobile/example.net
 *
 * @param adPath
 */

export const extractPositionFromPath = (adPath: string | undefined): string | undefined => {
  if (!adPath) {
    return undefined;
  }
  return adPath
    .replace(/^google_ads_iframe_\//, '') // Remove the prefix
    .replace(/_\d+__container__$/, ''); // Remove the suffix with any number
};
