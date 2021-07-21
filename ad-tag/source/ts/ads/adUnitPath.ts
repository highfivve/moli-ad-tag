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
