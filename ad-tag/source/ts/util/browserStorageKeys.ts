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
  /**
   * The storage key for the debug console theme (system/light/dark).
   */
  moliConsoleTheme: 'moli-console-theme',
  testSlotSize: (id: string) => `moli-test-slot-size-${id}`,
  debugDelay: 'moli-debug-delay',
  abTest: 'moli-ab-test'
};
