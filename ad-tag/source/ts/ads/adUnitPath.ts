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
 * for example: /1234567/Travel/{device}/{channel} ==> /1234567/Travel/mobile/finance
 * it should also consider potential nested path: /1234567/Travel/{device}/{device-}{channel} ==> /1234567/Travel/mobile/mobile-finance
 * */
export const resolveAdUnitPath = (
  adUnitPath: string,
  adUnitPathVariables?: AdUnitPathVariables
): void | string => {
  // Extract all params between the curly braces
  const paramsPattern = /[^{]+(?=})/g;
  let extractedParams = adUnitPath.match(paramsPattern);

  if (!adUnitPathVariables || !extractedParams) {
    return adUnitPath;
  }

  // Find the params that ends with '-'
  const refactoredExtractedParams = [...extractedParams];
  let refactoredAdUnitPathVariables = { ...adUnitPathVariables };
  extractedParams.forEach((param, index) => {
    if (param.endsWith('-')) {
      refactoredExtractedParams[index] = param + refactoredExtractedParams[index + 1];
      refactoredAdUnitPathVariables = {
        ...adUnitPathVariables,
        [param + refactoredExtractedParams[index + 1]]: refactoredExtractedParams[index]
      };
      refactoredExtractedParams.splice(index + 1, 1);
    }
  });
  extractedParams = refactoredExtractedParams;

  const variablesSet = new Set(Object.keys(refactoredAdUnitPathVariables));
  extractedParams.forEach(param => {
    if (!variablesSet.has(param)) {
      throw new ReferenceError(`path variable "${param}" is not defined`);
    }
  });

  const resolvedPath = adUnitPath
    .replace(
      new RegExp(
        Object.keys(refactoredAdUnitPathVariables)
          // Escape any special characters in the search key
          .map(key => key.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'))
          // Create the Regex pattern
          .join('|'),
        'g'
      ),
      // For each key found, replace with the appropriate value
      match => refactoredAdUnitPathVariables[match]
    )
    .replace(/[\{|}]/g, '');

  return resolvedPath;
};
