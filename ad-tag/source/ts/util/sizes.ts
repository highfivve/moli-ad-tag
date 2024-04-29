import { Moli } from '../types/moli';
import DfpSlotSize = Moli.GoogleAdManagerSlotSize;

/**
 * Checks if two dfp slot sizes are equal.
 */
export const isSizeEqual = (size1: DfpSlotSize, size2: DfpSlotSize): boolean => {
  return size1[0] === size2[0] && size1[1] === size2[1];
};
