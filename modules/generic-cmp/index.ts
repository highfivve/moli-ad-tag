import {
  IAssetLoaderService
} from '@highfivve/ad-tag/source/ts/util/assetLoaderService';
import { getLogger } from '@highfivve/ad-tag/source/ts/util/logging';
import { IABConsentManagement } from '@highfivve/ad-tag/source/ts/types/IABConsentManagement';
import { Moli } from '@highfivve/ad-tag';
import CmpModule = Moli.consent.CmpModule;
import loadStub = require('./cmpStub');


/**
 * == Generic Consent Managment Platform Module ==
 */
export default class Cmp implements CmpModule {

  public readonly name: string = 'generic-cmp';
  public readonly description: string = 'IAB compliant CMP';
  public readonly moduleType = 'cmp';

  /**
   * Indicates if the faktor.io bundle has been loaded
   */
  private readonly cmpLoaded: Promise<void>;

  constructor(private readonly window: Window) {
    loadStub(window);
    this.cmpLoaded = new Promise<void>(resolve => {
        this.checkCmpRead(resolve);
      }
    );
  }

  config(): Object | null {
    return null;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    const log = getLogger(config, this.window);
    if (config.consent.cmp) {
      log.error('Generic CMP', `There is already another cmp module registered: ${config.consent.cmp.name}`);
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
    return this.cmpLoaded.then(() => {
      return new Promise<IABConsentManagement.IConsentData>(resolve => {
        this.window.__cmp('getConsentData', null, (consentData: IABConsentManagement.IConsentData | null, _success) => {
          consentData ? resolve(consentData) : resolve();
        });
      });
    });
  }

  getVendorConsents(): Promise<IABConsentManagement.IVendorConsents> {
    return this.cmpLoaded.then(() => {
      return new Promise<IABConsentManagement.IVendorConsents>(resolve => {
        this.window.__cmp('getVendorConsents', null, (consentData: IABConsentManagement.IVendorConsents, _success) => {
          resolve(consentData);
        });
      });
    });
  }

  isCmpRead(): Promise<void> {
    return this.cmpLoaded;
  }

  private checkCmpRead(resolve: () => void): void {
    this.window.__cmp('ping', null, response => {
      if (response.cmpLoaded) {
        resolve();
      } else {
        setTimeout(() => this.checkCmpRead(resolve), 200);
      }
    });

    return;
  }
}
