export namespace tcfapi {
  /**
   * @see https://iabtcf.com/api/core/
   * @see https://github.com/InteractiveAdvertisingBureau/iabtcf-es/tree/master/modules/cmpapi
   * @see https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20CMP%20API%20v2.md
   */
  export interface TCFApiWindow {
    __tcfapi?: TCFApi;
  }

  export type TCFApiVersion = 2 | undefined | null;

  export interface BooleanVector {
    /**
     * true - Consent
     * false | undefined - No Consent.
     */
    [id: string]: boolean;
  }

  /**
   * the global API
   */
  export interface TCFApi {
    (command: 'ping', version: TCFApiVersion, callback: (pingReturn: responses.Ping) => void): void;

    (
      command: 'addEventListener',
      version: TCFApiVersion,
      callback: (tcData: responses.TCData, success: boolean) => void
    ): void;

    (
      command: 'removeEventListener',
      version: TCFApiVersion,
      callback: (success: boolean) => void,
      listenerId: number
    ): void;
  }

  export namespace responses {
    export interface Response {
      readonly cmpId: number;
      readonly cmpVersion: number;

      readonly cmpStatus: status.CmpStatus;

      /**
       * true - GDPR Applies
       * false - GDPR Does not apply
       * undefined - unknown whether GDPR Applies
       * see the section: "What does the gdprApplies value mean?"
       */
      readonly gdprApplies: boolean | undefined;
      readonly tcfPolicyVersion: number | undefined;
    }

    export interface Ping extends Response {
      readonly displayStatus: status.DisplayStatus;

      /**
       * Note: cmpLoaded must be set to true if the main script is loaded and the stub interface is replaced,
       *       regardless of whether or not the user will see the UI or interact with it
       *
       * true - CMP main script is loaded
       * false - still running stub
       */
      readonly cmpLoaded: boolean;
    }

    export type TCData = TCDataWithGDPR | TCDataNoGDPR;

    export enum TCPurpose {
      STORE_INFORMATION_ON_DEVICE = 1,
      SELECT_BASIC_ADS = 2,
      CREATE_PERSONALISED_ADS_PROFILE = 3,
      SELECT_PERSONALISED_ADS = 4,
      CREATE_PERSONALISED_CONTENT_PROFILE = 5,
      SELECT_PERSONALISED_CONTENT = 6,
      MEASURE_AD_PERFORMANCE = 7,
      MEASURE_CONTENT_PERFORMANCE = 8,
      APPLY_MARKET_RESEARCH = 9,
      DEVELOP_IMPROVE_PRODUCTS = 10
    }
    export type PurposeVector = {
      [purpose in TCPurpose]: boolean;
    };

    export interface TCDataWithGDPR extends Response {
      /**
       * GDPR applies
       */
      readonly gdprApplies: true;

      readonly tcString: string;
      /**
       * If this TCData is sent to the callback of addEventListener: number,
       * the unique ID assigned by the CMP to the listener function registered
       * via addEventListener.
       * Others: undefined.
       */
      readonly listenerId: number | undefined | null;

      /**
       * see addEventListener command
       */
      readonly eventStatus: status.EventStatus;
      /**
       * true - if using a service-specific or publisher-specific TC String
       * false - if using a global TC String.
       */
      readonly isServiceSpecific: boolean;

      /**
       * true - CMP is using publisher-customized stack descriptions
       * false - CMP is NOT using publisher-customized stack descriptions
       */
      readonly useNonStandardStacks: boolean;

      /**
       * Country code of the country that determines the legislation of
       * reference.  Normally corresponds to the country code of the country
       * in which the publisher's business entity is established.
       */
      readonly publisherCC: string;

      /**
       * Only exists on service-specific TC
       *
       * true - Purpose 1 not disclosed at all. CMPs use PublisherCC to
       * indicate the publisher's country of establishment to help Vendors
       * determine whether the vendor requires Purpose 1 consent.
       *
       * false - There is no special Purpose 1 treatment status. Purpose 1 was
       * disclosed normally (consent) as expected by TCF Policy
       */
      readonly purposeOneTreatment: boolean;

      readonly purpose: {
        readonly consents: PurposeVector;

        readonly legitimateInterests: BooleanVector;
      };

      readonly vendor: {
        readonly consents: BooleanVector;
        readonly legitimateInterests: BooleanVector;
      };

      readonly specialFeatureOptins: BooleanVector;

      readonly publisher: {
        consents: BooleanVector;
        legitimateInterests: BooleanVector;

        customPurpose: {
          consents: BooleanVector;
          legitimateInterests: BooleanVector;
        };

        restrictions: {
          [purposeId: string]: {
            [vendorId: string]: RestrictionType;
          };
        };
      };
    }

    export interface TCDataNoGDPR extends Response {
      /**
       * GDPR does not apply
       */
      readonly gdprApplies: false | undefined;

      /**
       * If this TCData is sent to the callback of addEventListener: number,
       * the unique ID assigned by the CMP to the listener function registered
       * via addEventListener.
       * Others: undefined.
       */
      readonly listenerId: number | undefined | null;

      /**
       * see addEventListener command
       */
      readonly eventStatus: status.EventStatus;

      readonly tcfPolicyVersion: undefined;
    }

    /**
     * if a Vendor has declared flexible purpose (see: [[Vendor]] under
     * `flexiblePurposeIds`) on the Global Vendor List ([[Declarations]]) a CMP may
     * change their legal basis for processing in the encoding.
     */
    export enum RestrictionType {
      /**
       * under no circumstances is this purpose allowed.
       */
      NOT_ALLOWED = 0,

      /**
       * if the default declaration is legitimate interest then this flips the purpose to consent in the encoding.
       */
      REQUIRE_CONSENT = 1,

      /**
       * if the default declaration is consent then this flips the purpose to Legitimate Interest in the encoding.
       */
      REQUIRE_LI = 2
    }
  }

  export namespace status {
    /**
     * An enum representing all the possible statuses for the displayStatus
     * returned through the CMP API
     *
     * @readonly
     * @enum {string}
     */

    export enum DisplayStatus {
      /**
       * User interface is currently displayed
       * @type {string}
       */
      VISIBLE = 'visible',
      /**
       * User interface is not yet or no longer displayed
       * @type {string}
       */
      HIDDEN = 'hidden',
      /**
       * User interface will not show (e.g. GDPR does not apply or TC data is current and does not need renewal)
       * @type {string}
       */
      DISABLED = 'disabled'
    }

    /**
     * An enum representing all the possible statuses for the cmpStatus returned
     * through the CMP API
     *
     * @readonly
     * @enum {string}
     */

    export enum CmpStatus {
      /**
       * CMP not yet loaded – stub still in place
       * @type {string}
       */
      STUB = 'stub',
      /**
       * CMP is loading
       * @type {string}
       */
      LOADING = 'loading',
      /**
       * CMP is finished loading
       * @type {string}
       */
      LOADED = 'loaded',
      /**
       * CMP is in an error state. A CMP shall not respond to any other API requests if this cmpStatus is present.
       * A CMP may set this status if, for any reason, it is unable to perform the operations in compliance with the TCF.
       * @type {string}
       */
      ERROR = 'error'
    }

    /**
     * EventStatus enum represents the possible values of the eventStatus property of the TCData
     */
    export enum EventStatus {
      /**
       * A CMP is loaded and is prepared to surface a TC String to any calling scripts on the page
       * @type {string}
       */
      TC_LOADED = 'tcloaded',
      /**
       * The UI is surfaced or re-surfaced
       * And TC String is available and has rendered "Transparency" in accordance with the TCF Policy.
       * @type {string}
       */
      CMP_UI_SHOWN = 'cmpuishown',
      /**
       * User has confirmed or re-confirmed their choices in accordance with TCF Policy
       * and a CMP is prepared to respond to any calling scripts with the corresponding TC String.
       * @type {string}
       */
      USER_ACTION_COMPLETE = 'useractioncomplete'
    }
  }
}
