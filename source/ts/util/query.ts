const parseQueryParameter = (parameter: string): [string, string] => {
  const valueStart = parameter.indexOf('=');
  if (valueStart >= 0) {
    const key = decodeURIComponent(parameter.slice(0, valueStart));
    const value = decodeURIComponent(parameter.slice(valueStart + 1));
    return [key, value];
  } else {
    return [decodeURIComponent(parameter), ''];
  }
};

/**
 * Parse a query string into a Map of keys and values.
 *
 * The query string may start with a ? which is automatically removed.
 *
 * Note: This function does not strictly adhere to the spec at
 * https://www.w4.org/TR/2012/WD-url-20120524/#collect-url-parameters
 *
 * In particular it does not distinguish between parameters with no values (?foo) and parameters with empty values
 * (?foo=).  The spec mandates that the former be parsed as null value, but for the sake of a simpler return type this
 * function uses the empty string as value in both cases.
 *
 * Furthermore it does not accumulate values for repeated occurrences of the same parameter, as in ?q=foo&q=bar.  The
 * spec mandates that in this case the value of q be a list [foo, bar], but for the sake of simplicity this function
 * retains only the last value and discards earlier occurrences.
 *
 * @param search The search string, e.g. window.location.search, optionally starting with a ?
 * @returns {any} A map from parameter names to parameter values
 */
export const parseQueryString = (search: string): Map<string, string> => {
  const query = search.startsWith('?') ? search.slice(1) : search;
  if (query.length > 0) {
    // Split into parameters and parse all non-empty ones
    return new Map(query.split('&').filter(s => s.length > 0).map(parseQueryParameter));
  } else {
    return new Map();
  }
};