import { extractTopPrivateDomainFromHostname } from '../util/extractTopPrivateDomainFromHostname';

/**
 * The new MCM that allows managing child publishers, the ad unit path must
 * contain the parent networkId as well as the child networkId separated by a
 * comma.
 *
 * E.g. `/1234567,1234/Travel`
 *
 * This method removes the child id in order to keep down stream systems that
 * use the `adUnitPath` as an identifier unchanged. This includes
 *
 * - Amazon TAM bidder mappings
 * - Ad Reloads
 * - Yield Optimization
 *
 * From the google documentation the `code` or `ad unit path`
 * > is a string of characters that is used in ad tags for an ad unit.
 * > Codes can be up to 100 characters and are not case-sensitive.
 * > Only letters, numbers, underscores, hyphens, periods, asterisks,
 * > exclamations, left angle brackets, colons, forward slashes and parentheses
 * > are allowed.
 *
 * @param adUnitPath
 * @see https://support.google.com/admanager/answer/10477476?hl=en&ref_topic=10478086
 * @see https://support.google.com/admanager/answer/9611105?hl=en
 */
export const removeChildId = (adUnitPath: string): string => {
  const [_, networkIds, ...rest] = adUnitPath.split('/');
  const [parentNetworkId, ...childIds] = networkIds.split(',');
  return childIds.length === 0 ? adUnitPath : ['', parentNetworkId, ...rest].join('/');
};

export type AdUnitPathVariables = {
  [key: string]: string;
};

/**
 * This method finds the params in the adUnitPath and replace them with the corresponding values in the adUnitPathVariables object
 * for example: `/1234567/Travel/{device}/{channel} ==> /1234567/Travel/mobile/finance`
 * It also detects all the special characters except the underscore.
 * @param adUnitPath the path to resolved
 * @param adUnitPathVariables key/value pairs to replace the adUnitPath keys with
 * @returns {string} resolved path
 * */
export const resolveAdUnitPath = (
  adUnitPath: string,
  adUnitPathVariables?: AdUnitPathVariables
): string => {
  // Extract all params between the curly braces
  const paramsPattern = /[^{]+(?=})/g;
  const validCharactersPattern = /([A-Za-z0-9\_]+)/g;
  const extractedParams = adUnitPath.match(paramsPattern);
  if (!adUnitPathVariables || !extractedParams) {
    return adUnitPath;
  }

  extractedParams.forEach(param => {
    const validParam = param.match(validCharactersPattern);
    if (!validParam) {
      throw new SyntaxError(`invalid variable "${param}" in path`);
    }
    if (!adUnitPathVariables[param]) {
      throw new ReferenceError(`path variable "${param}" is not defined`);
    }
  });

  return adUnitPath.replace(
    new RegExp(
      Object.keys(adUnitPathVariables)
        .map(key => `{${key}}`)
        .join('|'),
      'g'
    ),
    // For each key found, replace with the appropriate value
    match => adUnitPathVariables[match.substr(1, match.length - 2)]
  );
};

/**
 * We don't want to be the adUnitPath's in a9 as granular as they're in the google adManager.
 * For this reason, we reduce the depth of the adUnitPath in this method.
 *
 * E.g. `shortenWithDepth('/1234567/Travel/Germany/Berlin', 3) will result in '/1234567/Travel/Germany'`
 *
 * @param adUnitPath The adUnitPath that should be shortened.
 * @param depth The maximum depth of the adUnitPath.
 */
export const withDepth = (adUnitPath: string, depth: number): string => {
  const adUnitPathSegments = adUnitPath.split('/');

  return adUnitPathSegments.slice(0, depth + 1).join('/');
};

/**
 * Builds an ad unit path variables object
 *
 * @param hostname - hostname, usually provided via `window.location.hostname`
 * @param device - mobile | desktop, usually provided by the labelService
 * @param varsFromConfig - optional configuration from ad tag config, which overrides the default variables
 */
export const generateAdUnitPathVariables = (
  hostname: string,
  device: 'mobile' | 'desktop',
  varsFromConfig?: AdUnitPathVariables
): AdUnitPathVariables => ({
  ...{ device: device, domain: extractTopPrivateDomainFromHostname(hostname) || 'unknown' },
  ...varsFromConfig
});
