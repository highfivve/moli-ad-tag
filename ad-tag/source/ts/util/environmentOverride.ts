import { Moli } from '../types/moli';
import { BrowserStorageKeys } from './browserStorageKeys';
import {
  getBrowserStorageValue,
  removeBrowserStorageValue,
  setBrowserStorageValue
} from './localStorage';
import { nonNullElement } from './nonNullElement';
import { parseQueryString, updateQueryString } from './query';
import { QueryParameters } from './queryParameters';

export type EnvironmentOverride = {
  source: 'queryParam' | 'localStorage' | 'sessionStorage';
  environment: Moli.Environment;
};

/**
 * Type guard to test whether a string is a valid environment.
 */
const isEnvironmentString = (environment: string): environment is Moli.Environment => {
  const validValues: Moli.Environment[] = ['production', 'test'];
  return !!validValues.find(value => value === environment);
};

/**
 * Returns the active environment override. The precedence is defined via the array in getAllEnvironmentOverrides().
 */
export const getActiveEnvironmentOverride = (window: Window): EnvironmentOverride | undefined =>
  getAllEnvironmentOverrides(window)[0] || undefined;

/**
 * The environment configuration can be overriden with a sepcific query param, localStorage or sessionStorage value.
 * This allows us to either force a production or test environment, which eases the integration for the publisher.
 *
 * Example with query param:
 * {@link https://local.h5v.eu:9000/?moliEnv=test}
 */
export const getAllEnvironmentOverrides = (window: Window): EnvironmentOverride[] => {
  return [
    {
      source: 'queryParam' as const,
      environment: parseQueryString(window.location.search).get(QueryParameters.moliEnv)
    },
    {
      source: 'sessionStorage' as const,
      environment: getBrowserStorageValue(BrowserStorageKeys.moliEnv, window.sessionStorage)
    },
    {
      source: 'localStorage' as const,
      environment: getBrowserStorageValue(BrowserStorageKeys.moliEnv, window.localStorage)
    }
  ]
    .map(({ source, environment }) =>
      !!environment && isEnvironmentString(environment) ? { source, environment } : undefined
    )
    .filter(nonNullElement);
};

/**
 * Typesafe set environment to browser storage.
 */
export const setEnvironmentOverrideInStorage = (value: Moli.Environment, storage: Storage) =>
  setBrowserStorageValue(BrowserStorageKeys.moliEnv, value, storage);

/**
 * Resets all environment overrides.
 */
export const resetEnvironmentOverrides = (window: Window) => {
  removeBrowserStorageValue(BrowserStorageKeys.moliEnv, window.sessionStorage);
  removeBrowserStorageValue(BrowserStorageKeys.moliEnv, window.localStorage);
  window.location.replace(updateQueryString(QueryParameters.moliEnv, undefined));
};
