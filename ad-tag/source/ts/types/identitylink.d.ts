export namespace ATS {
  /**
   * The config object needed for window.ats.start.
   *
   * Parameters and types scraped manually from https://docs.authenticated-traffic-solution.com/docs and its sub-pages.
   */
  export type Config = {
    placementID: number;
    storageType: 'localStorage' | 'cookie';
    rootDomain?: string;
    email?: string;
    phoneNumber?: string;
    emailHashes?: Array<string>;
    cssSelectors?: Array<string>;
    logging: 'debug' | 'info' | 'warn' | 'error';
  };

  /**
   * "Envelope" object received when calling window.ats.retrieveEnvelope. There's no reliable public documentation
   * about the structure of the envelope, except for the fuzzy description on the "IdentityLink in RTB"
   * [github page](https://github.com/Advertising-ID-Consortium/IdentityLink-in-RTB):
   *
   * {"envelope":"AjfowMv4ZHZQJFM8TpiUnYEyA81Vdgg"}
   *
   * This could either mean that the envelope is an object that contains an "envelope" field with the initialization
   * vector as string, or that "envelope" is an alias for the initialization vector string itself.
   */
  export type Envelope = any;

  export type Window = Window & {
    /**
     * LiveRamps  (authenticated traffic solution) implementation.
     *
     * Docs from https://docs.authenticated-traffic-solution.com/docs/atsjs-functions.
     */
    ats: {
      /**
       * Typically, this is the only function you will need to call.
       *
       * This function should be placed into its own <script> tag and called with your configuration object just after
       * the <script> tag for ats.js. The library will not begin to run processing or detection until it is started.
       */
      start: (config: Config) => void;

      /**
       * Fetch envelope from configured storage; the callback function is optional. If the function is called without a
       * callback, a promise will be returned. If function is called with callback, an envelope value will be returned.
       */
      retrieveEnvelope: (callback?: (envelope: Envelope) => void) => Promise<Envelope> | void;

      /**
       * This function will (re)scan DOM elements with the CSS selectors specified in your configuration. You can call
       * this function if the ats.js library has been started.
       */
      triggerDetection: () => void;
    };
  };
}
