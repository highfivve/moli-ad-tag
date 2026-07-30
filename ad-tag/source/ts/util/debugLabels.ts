import { parseQueryString } from './query';
import {
  getBrowserStorageValue,
  removeBrowserStorageValue,
  setBrowserStorageValue
} from './localStorage';
import { QueryParameters } from './queryParameters';
import { BrowserStorageKeys } from './browserStorageKeys';

/**
 * Parses the `moliLabels` query parameter into a list of labels.
 *
 * Comma-separated, each token trimmed, empty tokens dropped.
 */
export const getMoliLabelsFromQueryParam = (window: Window): string[] =>
  (parseQueryString(window.location.search).get(QueryParameters.moliLabels) ?? '')
    .split(',')
    .map(label => label.trim())
    .filter(label => label.length > 0);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(entry => typeof entry === 'string');

/**
 * Parses the `moli-labels` localStorage entry (a JSON string array) into a list of labels.
 *
 * Malformed JSON or an unexpected shape resolves to an empty array instead of throwing.
 */
export const getMoliLabelsFromStorage = (window: Window): string[] => {
  const raw = getBrowserStorageValue(BrowserStorageKeys.moliLabels, window.localStorage);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return isStringArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

/**
 * Appends a label to the `moli-labels` localStorage entry.
 */
export const addMoliLabelToStorage = (window: Window, label: string): void => {
  const labels = [...getMoliLabelsFromStorage(window), label];
  setBrowserStorageValue(
    BrowserStorageKeys.moliLabels,
    JSON.stringify(labels),
    window.localStorage
  );
};

/**
 * Removes all occurrences of the given label from the `moli-labels` localStorage entry.
 */
export const removeMoliLabelFromStorage = (window: Window, label: string): void => {
  const labels = getMoliLabelsFromStorage(window).filter(entry => entry !== label);
  setBrowserStorageValue(
    BrowserStorageKeys.moliLabels,
    JSON.stringify(labels),
    window.localStorage
  );
};

/**
 * Removes the `moli-labels` key from localStorage entirely.
 */
export const clearMoliLabelsFromStorage = (window: Window): void => {
  removeBrowserStorageValue(BrowserStorageKeys.moliLabels, window.localStorage);
};
