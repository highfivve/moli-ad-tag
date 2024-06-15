import { parseQueryString } from './query';
import { getBrowserStorageValue } from './localStorage';
import { isNotNull } from './arrayUtils';

export type OverrideValue<T> = {
  source: 'queryParam' | 'localStorage' | 'sessionStorage';
  value: T;
};

/**
 * The ad tag provides a couple of parameters that can be overridden for testing and debugging purposes.
 * This method resolves the overrides from the query param, localStorage and/or sessionStorage.
 *
 * # Use case
 *
 * - setting the environment to test
 * - setting the publisher code to a specific value
 * - setting the version to a specific value
 *
 * # Examples
 *
 * ## Query Param
 *
 * {@link https://local.h5v.eu:9000/?moliEnv=test}
 *
 * ## Local Storage
 *
 * ```ts
 * window.localStorage.setItem('moli-env', 'test');
 * ```
 *
 * ## Session Storage
 *
 * ```ts
 * window.sessionStorage.setItem('moli-env', 'test');
 * ```
 */
export const resolveOverrides = <T extends string = string>(
  window: Window,
  queryParam: string,
  storageKey: string,
  predicate: (value: string) => value is T = (value): value is T => true
): OverrideValue<T>[] => {
  return [
    {
      source: 'queryParam' as const,
      value: parseQueryString(window.location.search).get(queryParam)
    },
    {
      source: 'sessionStorage' as const,
      value: getBrowserStorageValue(storageKey, window.sessionStorage)
    },
    {
      source: 'localStorage' as const,
      value: getBrowserStorageValue(storageKey, window.localStorage)
    }
  ]
    .map(({ source, value }) => (!!value && predicate(value) ? { source, value } : undefined))
    .filter(isNotNull);
};
