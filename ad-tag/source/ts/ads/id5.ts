import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { prebidjs } from 'ad-tag/types/prebidjs';

type Id5PartnerData = {
  /**
   * SHA256 Hashed Email
   */
  readonly 1: string;

  /**
   * SHA256 Hashed Phone Number
   */
  readonly 2?: string;

  /**
   * IPv4 Address of the end-user’s device
   */
  readonly 10?: string;

  /**
   * IPv6 Address of the end-user’s device
   */
  readonly 11?: string;
};

const createPd = (runtimeConfig: MoliRuntime.MoliRuntimeConfig): string | null => {
  const sha256Email = runtimeConfig.audience?.hem?.sha256;
  if (!sha256Email) {
    return null;
  }
  // this is from the ID5 documentation
  // set the keys and URL-encode each value
  const pdKeys: Id5PartnerData = {
    1: sha256Email
  };

  // convert the key/values into a querystring format
  const pdRaw = Object.entries(pdKeys)
    .map(([key, value]) => {
      return `${key}=${encodeURIComponent(value)}`;
    })
    .join('&');
  return btoa(pdRaw);
};

/**
 * Iterates over the provided userIds and, if ID5 is found, enriches it with partner data (pd)
 *
 * @param runtimeConfig - runtime parameters that can be set by publisher
 * @param userIds - a list of enabled user ID providers
 * @see https://wiki.id5.io/identitycloud/retrieve-id5-ids/passing-partner-data-to-id5
 */
export const enrichId5WithFpd = (
  runtimeConfig: MoliRuntime.MoliRuntimeConfig,
  userIds?: prebidjs.userSync.UserIdProvider[]
): prebidjs.userSync.UserIdProvider[] | undefined => {
  return userIds?.map<prebidjs.userSync.UserIdProvider>(idProvider => {
    if (idProvider.name === 'id5Id') {
      const pd = createPd(runtimeConfig);
      return {
        ...idProvider,
        params: {
          ...idProvider.params,
          ...(pd && { pd })
        }
      };
    }
    return idProvider;
  });
};
