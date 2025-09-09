import { BrowserStorageKeys } from './browserStorageKeys';
import { removeBrowserStorageValue, setBrowserStorageValue } from './localStorage';
import { updateQueryString } from './query';
import { QueryParameters } from './queryParameters';
import { Environment } from '../types/moliConfig';
import { OverrideValue, resolveOverrides } from './resolveOverrides';

/**
 * Type guard to test whether a string is a valid environment.
 */
const isEnvironmentString = (environment: string): environment is Environment => {
  const validValues: Environment[] = ['production', 'test'];
  return !!validValues.find(value => value === environment);
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
