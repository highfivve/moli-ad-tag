/**
 * This interface contains all necessary information for a new release
 */
export interface ReleaseInformation {
  /**
   * The version of the new release
   */
  readonly version: number;

  /**
   * The changes / changelog message for this release.
   */
  readonly changes: string;

  /**
   * Whether the user wants to push the release or not.
   */
  readonly push: any;
}
