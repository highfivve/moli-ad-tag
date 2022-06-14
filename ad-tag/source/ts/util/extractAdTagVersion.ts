/**
 * Helper function to extract the currentVersion property from moli's releases.json file format.
 *
 * @param currentVersion the version number, if any. Could be number or string.
 *
 * @return string|undefined version number, if parseable
 */
export const extractAdTagVersion = ({
  currentVersion
}: {
  currentVersion?: unknown;
}): string | undefined => {
  try {
    switch (typeof currentVersion) {
      case 'number':
        return currentVersion.toFixed();
      case 'string':
        const num = Number(currentVersion);
        return Number.isNaN(num) ? undefined : num.toFixed();
      default:
        return undefined;
    }
  } catch (e) {
    return undefined;
  }
};
