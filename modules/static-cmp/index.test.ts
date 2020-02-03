import { expect, use, assert } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import CMP from './index';
import { createDom } from '@highfivve/ad-tag/tests/ts/stubs/browserEnvSetup';
import { Moli } from '@highfivve/ad-tag';


// setup sinon-chai
use(sinonChai);


// tslint:disable: no-unused-expression
describe('Generic CMP Module', () => {

  const sandbox = Sinon.createSandbox();
  let dom = createDom();

  const emptyConfig = (): Moli.MoliConfig => {
    return { slots: [], consent: {}, yieldOptimization: { provider: 'none' } };
  };

  afterEach(() => {
    dom = createDom();
    sandbox.reset();
  });

  it('should return nonPersonalizedAds 0 if configured with 0', () => {
    const config = emptyConfig();
    const cmp = new CMP({ nonPersonalizedAds: 0 }, dom.window);

    cmp.init(config, {} as any);

    return cmp.getNonPersonalizedAdSetting().then(setting => {
      expect(setting).to.eq(0);
    });
  });

  it('should return nonPersonalizedAds 1 if configured with 1', () => {
    const config = emptyConfig();
    const cmp = new CMP({ nonPersonalizedAds: 1 }, dom.window);

    cmp.init(config, {} as any);

    return cmp.getNonPersonalizedAdSetting().then(setting => {
      expect(setting).to.eq(1);
    });
  });

  it('should reject getConsentData requests', () => {
    const config = emptyConfig();
    const cmp = new CMP({ nonPersonalizedAds: 1 }, dom.window);

    cmp.init(config, {} as any);

    return cmp.getConsentData().then(consentData => {
      expect.fail(`Should fail, but could ${consentData}`);
    }).catch((err) => {
      expect(err).to.be.eq('getConsentData is not supported');
    });
  });

  it('should reject getConsetData requests', () => {
    const config = emptyConfig();
    const cmp = new CMP({ nonPersonalizedAds: 1 }, dom.window);

    cmp.init(config, {} as any);

    return cmp.getVendorConsents().then(vendorConsents => {
      expect.fail(`Should fail, but could ${vendorConsents}`);
    }).catch((err) => {
      expect(err).to.be.eq('getVendorConsents is not supported');
    });
  });

});
