/**
 * All necessary information we need from the version.json to read and update values.
 */
export interface IVersionJson {
  /**
   * The current version of the ad-tag release.
   * This value is taken as 'current version'. The script will increment the version and set this as default value.
   */
  currentVersion: string;
}
