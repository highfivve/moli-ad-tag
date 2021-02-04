import { getDefaultLogger } from './logging';

/**
 * Reads a value from the specified browser storage.
 * @param storage Either localStorage or sessionStorage
 */
export const getBrowserStorageValue = (
  key: string,
  storage: Storage = localStorage
): string | null => {
  try {
    return storage.getItem(key);
  } catch (e) {
    getDefaultLogger().debug(`Could not read value with key ${key} from browser storage`, storage);
    return null;
  }
};

/**
 * Sets a value to the specified browser storage.
 * @param storage Either localStorage or sessionStorage
 */
export const setBrowserStorageValue = (
  key: string,
  value: string,
  storage: Storage = localStorage
): void => {
  try {
    storage.setItem(key, value);
  } catch (e) {
    getDefaultLogger().debug(
      `Could not set key ${key} with value ${value} to browser storage`,
      storage
    );
  }
};

/**
 * Removes a value from the specified browser storage.
 * @param storage Either localStorage or sessionStorage
 */
export const removeBrowserStorageValue = (key: string, storage: Storage = localStorage): void => {
  try {
    storage.removeItem(key);
  } catch (e) {
    getDefaultLogger().debug(`Could not remove key ${key} from browser storage`, storage);
  }
};
