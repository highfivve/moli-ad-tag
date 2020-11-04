/**
 * All necessary information we need from the package.json to read and update values.
 */
export interface IPackageJson {
  /**
   * The version number in the package.json.
   * This value is taken as 'current version'. The script will increment the version and set this as default value.
   */
  version: string;
}
