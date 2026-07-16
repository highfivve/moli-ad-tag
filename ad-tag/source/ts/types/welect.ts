/**
 * Types for the Welect Ad Chooser SDK.
 *
 * The SDK is loaded through a partner specific bundle URL (see
 * `auction.RewardedAdWelectConfig.bundleUrl`) and exposes a global `Welect` object on the
 * window. All API methods are optional and callback based.
 *
 * @see https://www.welect.de/
 */
export namespace welect {
  /**
   * Callbacks for the `checkAvailability` call.
   */
  export interface CheckAvailabilityConfig {
    /**
     * Called if Welect can serve an ad session for this user.
     */
    onAvailable(): void;

    /**
     * Called if Welect cannot serve an ad session, e.g. no campaign is available for
     * this user.
     */
    onUnavailable(): void;
  }

  /**
   * Callbacks for the `runSession` call.
   */
  export interface RunSessionConfig {
    /**
     * Called once the user completed the Welect ad session and the reward should be granted.
     */
    onSuccess(): void;

    /**
     * Called if the user aborted the Welect ad session before completing it.
     */
    onAbort(): void;
  }

  /**
   * Callbacks for the `checkToken` call.
   */
  export interface CheckTokenConfig {
    /**
     * Called if a complete session is present, i.e. the user has watched an ad till the end.
     */
    onValid(): void;

    /**
     * Called if no complete session is present.
     */
    onInvalid(): void;
  }

  /**
   * The global Welect SDK API.
   */
  export interface Welect {
    /**
     * Checks if any ads are available.
     */
    checkAvailability?: (config: CheckAvailabilityConfig) => void;

    /**
     * Initiates the Welect overlay with its ad chooser.
     */
    runSession?: (config: RunSessionConfig) => void;

    /**
     * Analyzes the current window if a complete session is present.
     * A user has completed a session when the ad has been viewed till the end.
     */
    checkToken?: (config: CheckTokenConfig) => void;

    /**
     * Returns an URL which represents the Welect overlay with its ad chooser.
     */
    startURL?: () => string;
  }

  /**
   * Window with the global Welect SDK. The property is only defined once the partner
   * specific bundle has been loaded.
   */
  export interface WelectWindow {
    Welect?: Welect;
  }
}
