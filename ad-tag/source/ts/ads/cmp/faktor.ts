import { IABConsentManagement } from '../../types/IABConsentManagement';
import { ICmpService } from './cmpService';
import IConsentData = IABConsentManagement.IConsentData;
import IVendorConsents = IABConsentManagement.IVendorConsents;
import { ReportingService } from '../reportingService';
import loadCmpFaktorStub = require('./cmpFaktorStub');
import { Moli } from '../../types/moli';

interface IFaktorCMPApi {

  /**
   * IAB CMP global API
   */
  __cmp: {

    /**
     * Configure Faktor.io
     *
     * @param config not documented by Faktor.io. Will be generated via a frontend portal
     */
    start(config: any): void;
  };
}

/**
 * == Faktor.io CMP Service ==
 *
 * Provides an IAB compliant window.__cmp object.
 *
 *
 * @see https://faktor.atlassian.net/wiki/spaces/FK/pages/24412210/Privacy+Manager+Web
 * @see https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/CMP%20JS%20API%20v1.1%20Final.md
 */
export class FaktorCmp implements ICmpService {

  /**
   * Indicates if the faktor.io bundle has been loaded
   */
  private readonly faktorLoaded: Promise<void>;

  constructor(
    private readonly reportingService: ReportingService,
    private readonly logger: Moli.MoliLogger,
    private readonly window: Window
  ) {
    this.reportingService.markCmpInitialization();
    this.faktorLoaded = new Promise<void>(resolve => {
        loadCmpFaktorStub(window);
        this.logger.debug('Faktor CMP', 'loaded faktor stub');
        this.window.__cmp('addEventListener', 'cmpReady', resolve);
      }
    );
    this.faktorLoaded
      .then(() => this.logger.debug('Faktor CMP', 'cmpReady'))
      .catch((e) => this.logger.debug('Faktor CMP', 'cmpReady call failed', e));
  }

  autoOptIn(): Promise<void> {
    return this.faktorLoaded
      .then(() => this.consentDataExists())
      .then(exists => exists ? Promise.resolve() : this.acceptAll());
  }

  getConsentData(): Promise<IConsentData> {
    return this.faktorLoaded.then(() => {
      return new Promise<IConsentData>(resolve => {
        this.window.__cmp('getConsentData', null, (consentData: IConsentData | null, _success) => {
          consentData ? resolve(consentData) : resolve();
        });
      });
    });
  }

  getVendorConsents(): Promise<IVendorConsents> {
    return this.faktorLoaded.then(() => {
      return new Promise<IVendorConsents>(resolve => {
        this.window.__cmp('getVendorConsents', null, (consentData: IVendorConsents, _success) => {
          resolve(consentData);
        });
      });
    });
  }

  /**
   * Checks if a user has already consent data present, either because he/she has already been
   * opted in or has denied consent by using our privacy manager page.
   */
  private consentDataExists(): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this.window.__cmp('consentDataExist', true, (exists: boolean) => {
        this.logger.debug('Faktor CMP', `consentDataExist: ${exists}`);
        if (exists) {
          this.reportingService.measureCmpLoadTime();
        }
        this.reportingService.trackConsentDataExists(exists);
        resolve(exists);
      });
    });
  }

  /**
   * Accepts all vendors and purposes in our configuration. Overrides any existing consent data
   * if present. Make sure that you first check `consentDataExists` first.
   */
  private acceptAll(): Promise<void> {
    return new Promise<void>(resolve => {
      this.window.__cmp('acceptAll', true, () => {
        this.logger.debug('Faktor CMP', 'calling accept all');
        this.reportingService.measureCmpLoadTime();
        resolve();
      });
    });
  }


}
