import { IABConsentManagement } from '../types/IABConsentManagement';
import { Moli } from '../types/moli';
import { cookieService } from '../util/cookieService';
import IVendorConsents = IABConsentManagement.IVendorConsents;

export const getPersonalizedAdSetting = (consent: Moli.consent.ConsentConfig, window: Window): Promise<0 | 1> => {

  const personalizedAds = consent.personalizedAds;
  switch (personalizedAds.provider) {
    case 'static': {
      return Promise.resolve(personalizedAds.value);
    }
    case 'cookie': {
      const nonPersonalizedAds: 0 | 1 = cookieService.exists(personalizedAds.cookie) &&
      cookieService.get(personalizedAds.cookie) === personalizedAds.valueForNonPersonalizedAds ? 1 : 0;
      return Promise.resolve(nonPersonalizedAds);
    }
    case 'cmp': {
      const result = new Promise<0 | 1>((resolve, reject) => {
        if (window.__cmp) {
          window.__cmp('getVendorConsents', null, (vendorConsents: IVendorConsents): void => {
            const consentForAds = vendorConsents.purposeConsents[ 1 ] &&
              vendorConsents.purposeConsents[ 2 ] &&
              vendorConsents.purposeConsents[ 3 ] &&
              vendorConsents.purposeConsents[ 4 ] &&
              vendorConsents.purposeConsents[ 5 ];
            resolve((!vendorConsents.gdprApplies || consentForAds) ? 0 : 1);
          });
        } else {
          reject('No window.__cmp object is available');
        }
      });
      const timeout = new Promise<0 | 1>(resolve => {
        setTimeout(resolve, personalizedAds.timeout);
      }).then(() => 1 as const);

      return Promise.race([result, timeout]);

    }
  }
};
