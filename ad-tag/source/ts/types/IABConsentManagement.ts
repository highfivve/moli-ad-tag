/**
 * Api Reference for IABs CMP
 *
 * @see {@link https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/CMP%20JS%20API%20v1.1%20Final.md}
 */
export namespace IABConsentManagement {

  /**
   * CMP means a company that can read the vendors chosen by a website operator
   * and the consent status of an end user (either service specific
   * (through a first-party cookie) or global (through a third-party cookie).
   * A CMP is not synonymous with a company that surfaces the user interface to a user
   * (although it can be the same)
   */
  export interface IGlobalCMPApi {

    /**
     * The "ping" command invokes the callback immediately with information about whether the main CMP script has
     * loaded yet and if GDPR has been configured for all users or just EU users.
     *
     * This requires this command's implementation and this configuration to be in the stub.
     *
     * @param command - 'ping'
     * @param args - ignored
     * @param callback - Callback(PingReturn object, success: boolean)
     * @private
     */
    __cmp(command: 'ping', args: null, callback: (data: IPingReturn) => void): void;

    /**
     *
     *
     * @param {"getVendorConsents"} command
     * @param {Array<number>} vendorIds
     *        The vendorIds array contains the vendor ids (as identified in the Global Vendor List) for which consent
     *        is being requested. If vendorIds is null or empty, the operation will return consent status for all
     *        vendors in the vendor list.
     * @param {(vendorConsents: IVendorConsents, success: boolean) => void} callback
     *        The callback function will be called with a VendorConsents object as the parameter.
     *        If vendorIds is provided and not empty, then VendorConsents.vendorConsents will only included IDs from
     *        vendorIds.The callback is called only after consent is obtained from the UI or existing cookies.
     *        The consent will be returned false ("No Consent") for any invalid vendorId.
     *        The boolean success parameter passed to the callback indicates whether the call to getVendorConsents() was successful.
     *
     * @private
     */
    __cmp(command: 'getVendorConsents', vendorIds: Array<number> | null, callback: (vendorConsents: IVendorConsents, success: boolean) => void): void;

    /**
     *
     * @param {"getConsentData"} command - getConsentData
     * @param {string | null }consentStringVersion - if consentStringVersion is provided, then fetch that version if available (else returns null).
     *                               if consentStringVersion is null, then the latest supported version of the consent string is returned.
     * @param {(consentData: IVendorConsentData | null, success: boolean) => void} callback
     *        The callback is called only after consent is obtained from the UI or existing cookies.
     *        The boolean success parameter passed to the callback indicates whether the call to getConsentData() was successful.
     */
    __cmp(command: 'getConsentData', consentStringVersion: string | null, callback: (consentData: IConsentData, success: boolean) => void): void;


    /**
     * The vendorIds array contains the vendor ids (as identified in the Global Vendor List) for which consent is being requested.
     * If vendorIds is null or empty, the operation will return consent status for all vendors in the vendor list. The callback
     * function will be called with a VendorConsents object as the parameter. If vendorIds is provided and not empty,
     * then VendorConsents.vendorConsents will only includes IDs from vendorIds. The callback is called only after consent is
     * obtained from the UI or existing cookies.
     *
     * The consent will be returned false ("No Consent") for any invalid vendorId. The boolean success parameter passed to the
     * callback indicates whether the call to getVendorConsents() was successful.
     *
     * @param command {"getVendorConsents"} command - getConsentData
     * @param vendorIds - If vendorIds is null or empty, the operation will return consent status for all vendors in the vendor list
     * @param callback
     */
    __cmp(command: 'getVendorConsents', vendorIds: number[] | null, callback: (consentData: IVendorConsents, success: boolean) => void): void;

    /**
     * Faktor.io specific event listeners.
     *
     * @see https://faktor.atlassian.net/wiki/spaces/FK/pages/309395472/Set+up+Event+Tracking+in+Google+Analytics
     *
     * @param command
     * @param event
     * @param callback
     * @private
     */
    __cmp(command: 'addEventListener', event: 'cmpReady' | 'acceptAllButtonClicked' | 'exitButtonClicked' | 'privacySettingsButtonClicked' | 'fingerprintButtonClicked', callback: () => void): void;


    /**
     * Faktor.io specific call to auto-opt-in users.
     *
     * @param command - acceptAll
     * @param acceptAll - true for auto-opt-in
     * @param callback - after auto-opt-in
     */
    __cmp(command: 'acceptAll', acceptAll: boolean, callback: () => void): void;

    /**
     * Faktor.io specific call to check if consent data exists.
     *
     * @param command 'consentDataExist'
     * @param param - not documented what the boolean parameter is good for
     * @param callback - true if consent data exists
     */
    __cmp(command: 'consentDataExist', param: boolean, callback: (exists: boolean) => void): void;

    /**
     * Faktor.io specific call to summon the consent manager.
     *
     * @param command - showConsentManager
     * @param show - To show or hide consent manager, if not passed of value is true consent manager will be shown and
     *                if value is false consent manager will be hidden
     * @param callback
     * @private
     */
    __cmp(command: 'showConsentManager', show: boolean, callback: (success: boolean) => void): void;

  }

  export interface IVendorConsentsObject {
    [vendorId: number]: boolean;
  }

  export interface IPurposeConsentsObject {
    /** Information storage and access */
    1?: boolean;

    /** Personalisation */
    2?: boolean;

    /** Ad selection, delivery, reporting */
    3?: boolean;

    /** Content selection, delivery, reporting */
    4?: boolean;

    /** Measurement */
    5?: boolean;
  }

  /**
   * contains the global purposes, and vendors, consented by the user.
   */
  export interface IVendorConsents {
    /**
     * The metadata is the base64url-encoded value of the following "header" information described in the cookie format:
     * - Cookie Version
     * - Created Timestamp
     * - Last Updated Timestamp
     * - Cmp Id
     * - Cmp Version
     * - Consent Screen
     * - Vendor List Version
     * - Publisher Purposes Version (for the PublisherConsent metadata only)
     */
    metadata: string;

    /**
     * true if user is determined (by geo-IP lookup) to be in the EU,
     * or the publisher has configured the CMP
     * (via a CMP-specific method not specified by this spec)
     * that they are a EU publisher and thus the CMP UI should be shown for everyone
     */
    gdprApplies: boolean;

    /**
     * true if the vendor consent data is retrieved from the global cookie,
     * false if from a publisher-specific (or publisher-group-specific) cookie
     */
    hasGlobalScope: boolean;

    purposeConsents: IPurposeConsentsObject;

    vendorConsents: IVendorConsentsObject;
  }

  /**
   * contains the entire base64url-encoded string of the vendor consent data
   */
  export interface IConsentData {
    /**
     * [base64url-encoded](https://tools.ietf.org/html/rfc4648#section-5) encoded string
     */
    consentData: string;

    /**
     * true if user is determined (by geo-IP lookup) to be in the EU,
     * or the publisher has configured the CMP
     * (via a CMP-specific method not specified by this spec)
     * that they are a EU publisher and thus the CMP UI should be shown for everyone
     */
    gdprApplies: boolean;

    /**
     * true if the vendor consent data is retrieved from the global cookie,
     * false if from a publisher-specific (or publisher-group-specific) cookie
     */
    hasGlobalScope: boolean;
  }

  /**
   * contains information about the loading status and configuration of the CMP
   */
  export interface IPingReturn {
    /**
     * true if publisher has configured CMP to apply GDPR to all (including non-EU) visitors
     */
    gdprAppliesGlobally: boolean;

    /**
     * true if CMP main script is loaded, false if still running stub
     */
    cmpLoaded: boolean;

  }

}

/* tslint:disable:interface-name */
declare global {

  /**
   * Add IAB __cmp to the global Window instance
   */
  interface Window extends IABConsentManagement.IGlobalCMPApi {
  }
}
/* tslint:enable */
