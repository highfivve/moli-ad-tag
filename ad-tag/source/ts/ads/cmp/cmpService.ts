import { IABConsentManagement } from '../../types/IABConsentManagement';
import IConsentData = IABConsentManagement.IConsentData;
import IVendorConsents = IABConsentManagement.IVendorConsents;

/**
 * == Consent Management Platform Service ==
 *
 * This service wraps the IAB cmp platform and the specific vendor we use to provide
 * this.
 */
export interface ICmpService {

  /**
   * This methods sets all consent-given for an unknown user (e.g. first visit).
   * As the implementation may load additional assets the return type is a promise.
   * When resolved the user is opted-in.
   *
   * @returns {Promise<void>}
   */
  autoOptIn(): Promise<void>;

  /**
   * Typed and promisified API for the IAB `getConsentData` call.
   *
   * @returns {Promise<IABConsentManagement.IConsentData>}
   */
  getConsentData(): Promise<IConsentData>;


  /**
   * Typed and promisified API for the IAB `getVendorConsents` call.
   *
   * @returns {Promise<IABConsentManagement.IVendorConsents>}
   */
  getVendorConsents(): Promise<IVendorConsents>;

}

