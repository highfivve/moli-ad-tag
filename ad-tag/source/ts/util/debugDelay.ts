import { BrowserStorageKeys } from './browserStorageKeys';
import {
  getBrowserStorageValue,
  removeBrowserStorageValue,
  setBrowserStorageValue
} from './localStorage';

/**
 * While using the testing environment, the delay of requesting ads may be simulated.
 * The exact delay can specified in the moli debugger and is stored in the local storage.
 */
export const executeDebugDelay = (window: Window, delay: number): Promise<void> =>
  delay ? new Promise(resolve => window.setTimeout(resolve, delay)) : Promise.resolve();

export const getDebugDelayFromLocalStorage = (window: Window) =>
  Number(getBrowserStorageValue(BrowserStorageKeys.debugDelay, window.localStorage)) || undefined;

export const setDebugDelayToLocalStorage = (window: Window, value: number) => {
  if (value) {
    setBrowserStorageValue(BrowserStorageKeys.debugDelay, value.toString(), window.localStorage);
  } else {
    removeBrowserStorageValue(BrowserStorageKeys.debugDelay, window.localStorage);
  }
};
