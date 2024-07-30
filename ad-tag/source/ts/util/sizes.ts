import { googleAdManager } from '../types/moliConfig';

/**
 * Checks if two dfp slot sizes are equal.
 */
export const isSizeEqual = (
  size1: googleAdManager.SlotSize,
  size2: googleAdManager.SlotSize
): boolean => {
  return size1[0] === size2[0] && size1[1] === size2[1];
};
