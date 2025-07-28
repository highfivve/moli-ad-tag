/**
 * Extracts the position from a Google Ads iframe path.
 *
 * Example path: google_ads_iframe_/33559401,22222222/example-publisher/ep_mobile_stickyad/mobile/example.net_0__container__
 * Result: ep_mobile_stickyad/mobile
 *
 * @param adPath
 */

export const extractPositionFromPath = (adPath: string | undefined): string | undefined => {
  if (!adPath) {
    return undefined;
  }
  adPath.match(/^google_ads_iframe_\/[^\/]+\/[^\/]+\/([^\/]+\/[^\/]+)/)?.[1] ?? '';
};
