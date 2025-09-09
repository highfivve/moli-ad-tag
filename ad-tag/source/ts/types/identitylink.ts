/**
 * @module identitylink/ats
 * @internal
 */
export namespace ATS {
  /**
   * "Envelope" object received when calling window.ats.retrieveEnvelope. There's no reliable public documentation
   * about the structure of the envelope, except for the fuzzy description on the "IdentityLink in RTB"
   * [github page](https://github.com/Advertising-ID-Consortium/IdentityLink-in-RTB):
   *
   * ```json
   * {"envelope":"AjfowMv4ZHZQJFM8TpiUnYEyA81Vdgg"}
   * ```
   *
   * This could either mean that the envelope is an object that contains an "envelope" field with the initialization
   * vector as string, or that "envelope" is an alias for the initialization vector string itself.
   */
  export type Envelope = any;

  /**
   * Passing raw emails: Once the email has been fetched from the provided technology (most likely through their public API),
   * you can pass the raw email to the ATS script as a variable as shown below.
   *
   * ```js
   * ats.setAdditionalData({'type':'email','id':'<EMAIL_VARIABLE>'})
   * ```
   *
   * The script will hash the email before the outgoing call will be made to LiveRamp to create the envelope.
   */
  export type ATSDataEmail = {
    readonly type: 'email';
    readonly id: string;
  };

  /**
   * Passing hashed emails: LiveRamp supports three different hash methods: SHA1, SHA256, and MD5. The hashed email(s)
   * have to be provided in an array and you can include up to all three methods in one push. Note that our ATS library
   * does not allow for an empty element or placeholder within an array. This will not result in an envelope even if it
   * contains a hashed email.
   *
   * While the ATS script only needs one hash to create the envelope, we highly recommend providing the ATS Library with
   * all three email hash types to get the best match rate. If you are only able to provide one hash, use SHA256 for
   * EU/EAA and SHA1 for U.S.
   *
   * ```js
   * ats.setAdditionalData({
   *    'type': 'emailHashes',
   *    'id': [
   *        "<EMAIL_HASH_SHA1>",
   *        "<EMAIL_HASH_SHA256>",
   *        "<EMAIL_HASH_MD5>"
   *    ]
   * })
   * ```
   *
   * The script will hash the email before the outgoing call will be made to LiveRamp to create the envelope.
   */
  export type ATSDataEmailHashes = {
    readonly type: 'emailHashes';
    readonly id: string[];
  };

  /**
   * Passing raw phone numbers: You can pass raw phone numbers directly to the ATS script with or without extraneous
   * characters. Our library automatically removes the following characters; +1, ., (, ), -, [space] before the phone
   * number is hashed and sent to the ATS API.
   *
   * ```js
   * atsenvelopemodule.setAdditionalData({
   *   id: '4155556656',
   *   type: 'phoneNumber'
   * });
   * ```
   */
  export type ATSDataPhoneNumber = {
    readonly type: 'phoneNumber';
    readonly id: string;
  };

  /**
   * Input for the setAdditionalData function
   */
  export type ATSData = ATSDataEmail | ATSDataEmailHashes | ATSDataPhoneNumber;

  /**
   * LiveRamps  (authenticated traffic solution) implementation.
   *
   * @see https://docs.liveramp.com/privacy-manager/en/ats-js-functions-and-events.html
   */
  export type ATSGlobal = {
    /**
     * Use this method to set email hashes.
     *
     * @param data
     * @see https://docs.liveramp.com/privacy-manager/en/configure-how-identifiers-are-obtained.html
     */
    setAdditionalData: (data: ATSData) => void;

    /**
     * This will return the current configuration object. The callback function is optional. In both ways it will return the current config object.
     */
    outputCurrentConfiguration: () => void;

    /**
     * Fetch envelope from configured storage; the callback function is optional. If the function is called without a
     * callback, a promise will be returned. If function is called with callback, an envelope value will be returned.
     */
    retrieveEnvelope: (callback?: (envelope: Envelope) => void) => Promise<Envelope> | void;

    /**
     * This function will remove the current envelope that is stored in local storage/cookie.
     */
    invalidateEnvelope: () => void;

    /**
     * This function will (re)scan DOM (Document Object Model) elements with the CSS selectors specified in your
     * configuration. You can call this function if the ATS.js library has been started.
     */
    triggerDetection: () => void;
  };

  export type ATSWindow = Window & {
    /**
     * LiveRamps  (authenticated traffic solution) implementation.
     *
     * @see https://docs.liveramp.com/privacy-manager/en/ats-js-functions-and-events.html
     */
    ats: ATSGlobal;

    /**
     * This variable is set, when the `window.addEventListener("envelopeModuleReady", callback)` callback fires.
     * The `window.ats` may or may not be defined!
     */
    atsenvelopemodule: ATSGlobal;
  };
}
