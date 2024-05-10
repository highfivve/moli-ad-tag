import { MoliRuntime } from '../types/moliRuntime';
import { SinglePageAppConfig } from '../types/moliConfig';

/**
 * Check if the refresh of ad slots is allowed based on the validateLocation setting.
 *
 * @param validateLocation configured by publisher how users should be validated
 * @param stateHref the previous href stored in ad tag state
 * @param currentLocation passed in via `window.location`
 */
export const allowRefreshAdSlot = (
  validateLocation: SinglePageAppConfig['validateLocation'],
  stateHref: string,
  currentLocation: Location
): boolean => {
  switch (validateLocation) {
    case 'none':
      return true;
    case 'href':
      return currentLocation.href === stateHref;
    case 'path':
      try {
        const url = new URL(stateHref);
        return currentLocation.pathname === url.pathname;
      } catch (e) {
        return true;
      }
  }
};

/**
 * Check if requestAds may be called.
 *
 * @param validateLocation configured by publisher how users should be validated
 * @param stateHref the previous href stored in ad tag state
 * @param currentLocation passed in via `window.location`
 */
export const allowRequestAds = (
  validateLocation: SinglePageAppConfig['validateLocation'],
  stateHref: string,
  currentLocation: Location
): boolean => {
  switch (validateLocation) {
    case 'none':
      return true;
    case 'href':
      return currentLocation.href !== stateHref;
    case 'path':
      try {
        const url = new URL(stateHref);
        return currentLocation.pathname !== url.pathname;
      } catch (e) {
        return true;
      }
  }
};
