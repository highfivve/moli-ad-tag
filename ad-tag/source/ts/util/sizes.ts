import { GoogleAdManagerSlotSize } from '../types/moliConfig';

/**
 * Checks if two dfp slot sizes are equal.
 */
export const isSizeEqual = (
  size1: GoogleAdManagerSlotSize,
  size2: GoogleAdManagerSlotSize
): boolean => {
  return size1[0] === size2[0] && size1[1] === size2[1];
};
