import {
  IAssetLoaderService
} from '@highfivve/ad-tag/source/ts/util/assetLoaderService';
import { getLogger } from '@highfivve/ad-tag/source/ts/util/logging';
import { IABConsentManagement } from '@highfivve/ad-tag/source/ts/types/IABConsentManagement';
import { Moli } from '@highfivve/ad-tag';
import CmpModule = Moli.consent.CmpModule;
import loadCmpFaktorStub = require('./faktorStub');


export interface IFaktorConfig {
  /**
   * if true an autoOptIn based on legitimate interest will be performed.
   * This will be disallowed in 2020
   *
   */
  autoOptIn: boolean;
}

/**
 * == Faktor.io Consent Managment Platform Module ==
 */
export default class Faktor implements CmpModule {

  public readonly name: string = 'faktor-cmp';
  public readonly description: string = 'IAB compliant CMP';
  public readonly moduleType = 'cmp';

  /**
   * Indicates if the faktor.io bundle has been loaded
   */
  private readonly faktorLoaded: Promise<void>;

  private log?: Moli.MoliLogger;

  constructor(private readonly faktorConfig: IFaktorConfig, private readonly window: Window) {
    loadCmpFaktorStub(window);
    this.faktorLoaded = new Promise<void>(resolve => {
        this.window.__cmp('addEventListener', 'cmpReady', resolve);
      }
    ).then(() => {
      // consider faktor.io loaded when the autoOptIn has been performed
      if (faktorConfig.autoOptIn) {
        return this.autoOptIn();
      }
      return Promise.resolve();
    });
  }

  config(): Object | null {
    return this.faktorConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    const log = getLogger(config, this.window);
    this.log = log;
    if (config.consent.cmp) {
      log.error('Faktor CMP', `There is already another cmp module registered: ${config.consent.cmp.name}`);
      return;
    }
    config.consent.cmp = this;
  }

  getNonPersonalizedAdSetting(): Promise<0 | 1> {
    return this.getVendorConsents().then(vendorConsents => {
      // if gdpr doesn't apply we allow personalized ads
      if (!vendorConsents.gdprApplies) {
        return 0;
      }
      const consentForAds = vendorConsents.purposeConsents[1] &&
        vendorConsents.purposeConsents[2] &&
        vendorConsents.purposeConsents[3] &&
        vendorConsents.purposeConsents[4] &&
        vendorConsents.purposeConsents[5];
      return consentForAds ? 0 : 1;
    });
  }

  getConsentData(): Promise<IABConsentManagement.IConsentData> {
    return this.faktorLoaded.then(() => {
      return new Promise<IABConsentManagement.IConsentData>(resolve => {
        this.window.__cmp('getConsentData', null, (consentData: IABConsentManagement.IConsentData | null, _success) => {
          this.logDebug('getConsentData');
          consentData ? resolve(consentData) : resolve();
        });
      });
    });
  }

  getVendorConsents(): Promise<IABConsentManagement.IVendorConsents> {
    return this.faktorLoaded.then(() => {
      return new Promise<IABConsentManagement.IVendorConsents>(resolve => {
        this.window.__cmp('getVendorConsents', null, (consentData: IABConsentManagement.IVendorConsents, _success) => {
          this.logDebug('getVendorConsents');
          resolve(consentData);
        });
      });
    });
  }

  getFaktorLoaded(): Promise<void> {
    return this.faktorLoaded;
  }

  private autoOptIn(): Promise<void> {
    return this.consentDataExists()
      .then(exists => {
        return exists ? Promise.resolve() : this.acceptAll().then(() => this.showConsentManager());
      });
  }

  /**
   * Checks if a user has already consent data present, either because he/she has already been
   * opted in or has denied consent by using our privacy manager page.
   */
  private consentDataExists(): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this.window.__cmp('consentDataExist', true, (exists: boolean) => {
        this.logDebug(`consent data exists: ${exists}`);
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
        this.logDebug('acceptAll');
        resolve();
      });
    });
  }

  private showConsentManager(): Promise<void> {
    return new Promise<void>(resolve => {
      this.window.__cmp('showConsentTool', true, () => {
        this.logDebug('show consent tool');
        resolve();
      });
    });
  }

  private logDebug(msg: string): void {
    if (this.log) {
      this.log.debug('Faktor CMP', msg);
    }
  }
}
