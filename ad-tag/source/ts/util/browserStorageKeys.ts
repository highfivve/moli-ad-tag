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
  testSlotSize: (id: string) => `moli-test-slot-size-${id}`,
  debugDelay: 'moli-debug-delay',
  abTest: 'moli-ab-test'
};
