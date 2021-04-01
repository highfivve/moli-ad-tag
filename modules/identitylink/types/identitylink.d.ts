/**
 * @module identitylink/ats
 * @internal
 */
export namespace ATS {
  /**
   * The config object needed for window.ats.start.
   *
   * Parameters and types scraped manually from https://docs.authenticated-traffic-solution.com/docs and its sub-pages.
   */
  export type Config = {
    /**
     * You will always need to include a valid placementID in your configuration object. This value is provided by
     * LiveRamp to identify your instance of ATS.
     */
    placementID: number;

    /**
     * You will always need to include a valid pixelID in your configuration object. This value is provided by
     * LiveRamp to identify your instance of ATS.
     */
    pixelID: number;

    /**
     * By default, the envelope (along with a generation timestamp and version information) is written to a first-party
     * cookie. You can alternatively instruct ATS to write into a localStorage object by changing the `storageType`
     * attribute.
     */
    storageType: 'localStorage' | 'cookie';

    /**
     * There are three possible detectionTypes:
     * 1. `scrape`: ATS can be configured to accept one or more standard CSS selectors that instruct it where to watch
     *    for identifiers. When you configure CSS selectors for ATS, detection is running when the page first loads
     *    (if the identifier already exists in the element) and when an onBlur event is fired on the element.
     * 2. `url`: You can alternatively instruct ATS to watch for an identifier in a URL parameter. For example, if users
     *    click through email notifications and land on `https://example.com/alerts?email_trigger=imeyers@liveramp.com`,
     *    you can configure ATS to check values in the `email_trigger` parameter.
     *    ats.js also supports passing of hashed identifiers in the URL. Be sure to specify whether an email address or
     *    phone number is provided. As a hashed version of the configuration about, the user could click through to
     *    https://example.com/alerts?email_trigger=b2c0928035d5f521a880381dc7ec85df7b7e06b3.
     *
     *    The ats.js configuration would be enabled as:
     *    ```
     *    {
     *      "placementID": 9999,
     *      "detectionType": "url",
     *      "urlParameter": "email_trigger",
     *      "detectionSubject": "email"
     *    }
     *    ```
     * 3. `scrapeAndUrl`: You can instruct ATS to use both on-page and URL element by passing the `scrapeAndUrl`
     * attribute in the configuration.
     */
    detectionType?: 'scrape' | 'url' | 'scrapeAndUrl';

    /**
     * If `detectionType` is set to `url` or `scrapeAndUrl`, this is where you specify the URL parameter's identifier.
     */
    urlParameter?: string;

    /**
     * When using hashed parameter detection (`url` or `scrapeAndUrl` detection type), you have to specify which hashed
     * value can be found in the parameter.
     */
    detectionSubject?: 'email' | 'phoneNumber';

    /**
     * If you run ATS across multiple domains, consider specifying the rootDomain attribute. This will ensure that the
     * envelope is written (and made available) to the base domain, versus the current subdomain.
     */
    rootDomain?: string;

    /**
     * ats.js has two basic modes of operation: direct and detect. In direct mode, you provide the identifier directly
     * to the ATS library. If you already have user login information on your backend, a sure-fire way to ensure that
     * it is usable by demand is to include it directly in your configuration.
     *
     * We recommend that you pass either a plaintext email address, a plaintext phone number, or pass all three hash
     * types of an email address to ATS to ensure the best possible identity resolution (and therefore matches to users
     * that advertisers want to reach).
     *
     * If you decide to pass email hashes, make sure that you:
     *
     * a) Validate the email against a regular expression
     * b) Remove whitespace (spaces, tabs, etc)
     * c) Downcase the email address
     *
     * before hex-hashing the address.
     */
    email?: string;
    phoneNumber?: string;
    emailHashes?: Array<string>;

    /**
     * The CSS selectors to use when using ats.js in `scrape` or `scrapeAndUrl` modes.
     */
    cssSelectors?: Array<string>;

    /**
     * Log level.
     */
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

  export type ATSWindow = Window & {
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
