import { BrowserStorageKeys } from './browserStorageKeys';
import {
  getBrowserStorageValue,
  removeBrowserStorageValue,
  setBrowserStorageValue
} from './localStorage';
import { parseQueryString, updateQueryString } from './query';
import { QueryParameters } from './queryParameters';
import { Environment } from '../types/moliConfig';
import { OverrideValue, resolveOverrides } from './resolveOverrides';
import { isNotNull } from 'ad-tag/util/arrayUtils';

/**
 * Type guard to test whether a string is a valid environment.
 */
const isEnvironmentString = (environment: string): environment is Environment => {
  const validValues: Environment[] = ['production', 'test'];
  return !!validValues.find(value => value === environment);
};

/**
 * Type guard to test whether a string is a valid AB test value (number between 1 and 100).
 */
const isValidAbTestValue = (value: string): boolean => {
  const num = Number(value);
  return !isNaN(num) && num >= 1 && num <= 100;
};

/**
 * Returns the active environment override. The precedence is defined via the array in getAllEnvironmentOverrides().
 */
export const getActiveEnvironmentOverride = (window: Window): OverrideValue<Environment> =>
  resolveOverrides<Environment>(
    window,
    QueryParameters.moliEnv,
    BrowserStorageKeys.moliEnv,
    isEnvironmentString
  )[0] || undefined;

/**
 * The AB test value can be set via query param, localStorage or sessionStorage.
 * This allows us to force a specific AB test group for testing purposes.
 *
 * Example with query param:
 * {@link https://local.h5v.eu:9000/?ABtest=42}
 */
export const getAbTestValues = (
  window: Window,
  abTestQueryParam: string,
  abTestBrowserStorageKey: string
): { source: 'queryParam' | 'sessionStorage' | 'localStorage'; value: string }[] => {
  return [
    {
      source: 'queryParam' as const,
      value: parseQueryString(window.location.search).get(abTestQueryParam)
    },
    {
      source: 'sessionStorage' as const,
      value: getBrowserStorageValue(abTestBrowserStorageKey, window.sessionStorage)
    },
    {
      source: 'localStorage' as const,
      value: getBrowserStorageValue(abTestBrowserStorageKey, window.localStorage)
    }
  ]
    .map(({ source, value }) =>
      !!value && isValidAbTestValue(value) ? { source, value } : undefined
    )
    .filter(isNotNull);
};

/**
 * Typesafe set environment to browser storage.
 */
export const setEnvironmentOverrideInStorage = (value: Environment, storage: Storage) =>
  setBrowserStorageValue(BrowserStorageKeys.moliEnv, value, storage);

/**
 * Resets all environment overrides.
 */
export const resetEnvironmentOverrides = (window: Window) => {
  removeBrowserStorageValue(BrowserStorageKeys.moliEnv, window.sessionStorage);
  removeBrowserStorageValue(BrowserStorageKeys.moliEnv, window.localStorage);
  window.location.replace(updateQueryString(QueryParameters.moliEnv, undefined));
};
