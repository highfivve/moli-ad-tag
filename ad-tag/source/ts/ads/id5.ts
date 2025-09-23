import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import MoliRuntimeConfig = MoliRuntime.MoliRuntimeConfig;
import { prebidjs } from 'ad-tag/types/prebidjs';
import IID5Provider = prebidjs.userSync.IID5Provider;

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

const createPd = (runtimeConfig: MoliRuntimeConfig): string | null => {
  const sha256Email = runtimeConfig.audience?.hem?.sha256;
  if (sha256Email) {
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
  }
  return null;
};

/**
 *
 * @param runtimeConfig - runtime parameters that can be set by publisher
 * @see https://wiki.id5.io/identitycloud/retrieve-id5-ids/passing-partner-data-to-id5
 */
export const id5Config = (runtimeConfig: MoliRuntimeConfig): IID5Provider => {
  const pd = createPd(runtimeConfig);
  return {
    name: 'id5Id',
    storage: {
      type: 'html5',
      name: 'id5id', // create a cookie with this name
      expires: 90, // local storage entry lasts for 90 days
      refreshInSeconds: 8 * 3600 // refresh ID every 8 hours to ensure it is fresh
    },
    params: {
      partner: 1519,
      ...(pd && { pd })
    }
  };
};
