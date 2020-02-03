import {
  IAssetLoaderService
} from '@highfivve/ad-tag/source/ts/util/assetLoaderService';
import { getLogger } from '@highfivve/ad-tag/source/ts/util/logging';
import { IABConsentManagement } from '@highfivve/ad-tag/source/ts/types/IABConsentManagement';
import { Moli } from '@highfivve/ad-tag';
import CmpModule = Moli.consent.CmpModule;

export interface IStaticCmpConfig {

  /**
   * The setting is intentionally name like the gpt.js API to not add more confusion.
   *
   * 0: personalized ads
   * 1: no personalized ads
   */
  readonly nonPersonalizedAds: 0 | 1;

}


/**
 * == Static CMP ==
 *
 * Returns static values
 *
 */
export default class StaticCmp implements CmpModule {

  public readonly name: string = 'static-cmp';
  public readonly description: string = 'IAB compliant CMP that returns static values for each request';
  public readonly moduleType = 'cmp';


  constructor(private readonly staticCmpConfig: IStaticCmpConfig, private readonly window: Window) {

  }

  config(): Object | null {
    return this.staticCmpConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    const log = getLogger(config, this.window);
    if (config.consent.cmp) {
      log.error('No CMP', `There is already another cmp module registered: ${config.consent.cmp.name}`);
      return;
    }
    config.consent.cmp = this;
  }

  getNonPersonalizedAdSetting(): Promise<0 | 1> {
    return Promise.resolve(this.staticCmpConfig.nonPersonalizedAds);
  }

  getConsentData(): Promise<IABConsentManagement.IConsentData> {
    return Promise.reject('getConsentData is not supported');
  }

  getVendorConsents(): Promise<IABConsentManagement.IVendorConsents> {
    return Promise.reject('getVendorConsents is not supported');
  }

}
