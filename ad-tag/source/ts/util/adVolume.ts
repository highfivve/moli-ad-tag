/**
 * Converts `Targeting.adVolume` into cumulative `av1..avN` labels.
 *
 * @param adVolume the configured ad volume (1-10), or `undefined` if not set
 * @returns `['av1', ..., 'avN']` for a defined volume, `[]` if `undefined`
 */
export const adVolumeToLabels = (adVolume: number | undefined): string[] => {
  if (adVolume === undefined) {
    return [];
  }
  return Array.from({ length: adVolume }, (_, index) => `av${index + 1}`);
};
