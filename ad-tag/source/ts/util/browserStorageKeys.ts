export const BrowserStorageKeys = {
  /**
   * The storage key to override the environment.
   */
  moliEnv: 'moli-env',
  /**
   * The storage key to override the publisher code.
   */
  moliPubCode: 'moli-pub-code',

  /**
   * The storage key to override the version.
   */
  moliVersion: 'moli-version',

  /**
   * The storage key to override the analytics session.
   */
  molyAnalyticsSession: 'moli-analytics-session',
  testSlotSize: (id: string) => `moli-test-slot-size-${id}`,
  debugDelay: 'moli-debug-delay'
};
