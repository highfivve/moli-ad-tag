import '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { Moli } from '../../../source/ts';
import { getPersonalizedAdSetting } from '../../../source/ts/ads/personalizedAdsProvider';
import { IABConsentManagement } from '../../../source/ts/types/IABConsentManagement';
import { cookieService } from '../../../source/ts/util/cookieService';
import { cmpFunction } from '../stubs/cmpStubs';
import IVendorConsents = IABConsentManagement.IVendorConsents;



// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('personalizedAdsProvider', () => {

  const sandbox = Sinon.createSandbox();

  beforeEach(() => {
    sandbox.reset();
  });

  describe('static provider', () => {
    it('should provide the static value 0', () => {
      return getPersonalizedAdSetting({
        personalizedAds: {
          provider: 'static',
          value: 0
        }
      }).then(value => {
        expect(value).to.equal(0);
      });
    });

    it('should provide the static value 1', () => {
      return getPersonalizedAdSetting({
        personalizedAds: {
          provider: 'static',
          value: 1
        }
      }).then(value => {
        expect(value).to.equal(1);
      });
    });
  });


  describe('cookie provider', () => {

    const cookieExistsStub = sandbox.stub(cookieService, 'exists');
    const cookieGetStub = sandbox.stub(cookieService, 'get');
    const cookieConsentConfig: Moli.consent.ConsentConfig = {
      personalizedAds: {
        provider: 'cookie',
        cookie: 'consent-cookie',
        valueForNonPersonalizedAds: 'false'
      }
    };

    it('should return 0 when no cookie is set', () => {
      cookieExistsStub.returns(false);
      return getPersonalizedAdSetting(cookieConsentConfig).then(value => {
        expect(value).to.equal(0);
      });
    });

    it('should return 0 when the cookie value differs from the valueForNonPersonalizedAds setting', () => {
      cookieExistsStub.returns(true);
      cookieGetStub.returns('true');
      return getPersonalizedAdSetting(cookieConsentConfig).then(value => {
        expect(value).to.equal(0);
      });
    });

    it('should return 1 when the cookie value matches the valueForNonPersonalizedAds setting', () => {
      cookieExistsStub.returns(true);
      cookieGetStub.returns('false');
      return getPersonalizedAdSetting(cookieConsentConfig).then(value => {
        expect(value).to.equal(1);
      });
    });
  });

  describe('cmp provider', () => {

    const cmpConsentConfig: Moli.consent.ConsentConfig = {
      personalizedAds: {
        provider: 'cmp'
      }
    };


    after(() => {
      (window as any).__cmp = undefined;
    });

    it('should reject if no __cmp API is available', () => {
      (window as any).__cmp = undefined;
      return getPersonalizedAdSetting(cmpConsentConfig)
        .then((value) => expect.fail(value, 'rejected promise'))
        .catch(error => expect(error).to.equal('No window.__cmp object is available'));
    });

    it('should return 1 when not all purpose consents are given and gdpr applies', () => {
      const vendorConsents: IVendorConsents = {
        gdprApplies: true,
        metadata: '',
        hasGlobalScope: false,
        vendorConsents: {},
        purposeConsents: {
          1: true,
          2: true
        }
      };
      window.__cmp = cmpFunction(vendorConsents);
      return getPersonalizedAdSetting(cmpConsentConfig)
        .then((value) => expect(value).to.equal(1));
    });

    it('should return 0 when not all purpose consents are given, but gdpr does not apply', () => {
      const vendorConsents: IVendorConsents = {
        gdprApplies: false,
        metadata: '',
        hasGlobalScope: false,
        vendorConsents: {},
        purposeConsents: {
          1: true,
          2: true
        }
      };
      window.__cmp = cmpFunction(vendorConsents);
      return getPersonalizedAdSetting(cmpConsentConfig)
        .then((value) => expect(value).to.equal(0));
    });

    it('should return 0 when all purpose consents are given and gdpr applies', () => {
      const vendorConsents: IVendorConsents = {
        gdprApplies: true,
        metadata: '',
        hasGlobalScope: false,
        vendorConsents: {},
        purposeConsents: {
          1: true,
          2: true,
          3: true,
          4: true,
          5: true
        }
      };
      window.__cmp = cmpFunction(vendorConsents);
      return getPersonalizedAdSetting(cmpConsentConfig)
        .then((value) => expect(value).to.equal(0));
    });


    it('should return 0 when all purpose consents are given and gdpr does not apply', () => {
      const vendorConsents: IVendorConsents = {
        gdprApplies: true,
        metadata: '',
        hasGlobalScope: false,
        vendorConsents: {},
        purposeConsents: {
          1: true,
          2: true,
          3: true,
          4: true,
          5: true
        }
      };
      window.__cmp = cmpFunction(vendorConsents);
      return getPersonalizedAdSetting(cmpConsentConfig)
        .then((value) => expect(value).to.equal(0));
    });
  });

});


// tslint:enable
