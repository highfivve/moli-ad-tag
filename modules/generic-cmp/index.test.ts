import { expect, use } from 'chai';
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

  const cmpStub = sandbox.stub();
  const addStubBehaviour = (onCall: number, returnValue?: any) => {
    // @ts-ignore TS7031
    cmpStub.onCall(onCall).callsFake((command, param, callback) => callback(returnValue));
  };

  afterEach(() => {
    dom = createDom();
    sandbox.reset();
  });


  it('should init the cmp stub', () => {
    expect((dom.window as any).__cmp).to.be.undefined;

    const config = emptyConfig();
    const module = new CMP(dom.window);

    module.init(config, {} as any);
    expect((dom.window as any).__cmp).to.be.ok;
  });

  it('should add itself as a cmp module', () => {
    const config = emptyConfig();
    const module = new CMP(dom.window);

    expect(config.consent.cmp).to.be.undefined;
    module.init(config, {} as any);
    expect(config.consent.cmp).to.be.ok;
    expect(config.consent.cmp!.name).to.be.equals('generic-cmp');
  });

  it('should return nonPersonalizedAds 0 if all gdpr does not apply', () => {
    const cmp = new CMP(dom.window);
    dom.window.__cmp = cmpStub;
    addStubBehaviour(0, { cmpLoaded: true });
    addStubBehaviour(1, {
      gdprApplies: false
    });

    return cmp.getNonPersonalizedAdSetting().then((nonPersonalizedAds) => {
      expect(nonPersonalizedAds).to.equal(0);
    });
  });

  it('should return nonPersonalizedAds 0 if all purposeConsents are given', () => {
    const cmp = new CMP(dom.window);
    dom.window.__cmp = cmpStub;
    addStubBehaviour(0, { cmpLoaded: true });
    addStubBehaviour(1, {
      gdprApplies: true,
      purposeConsents: {
        1: true,
        2: true,
        3: true,
        4: true,
        5: true
      }
    });

    return cmp.getNonPersonalizedAdSetting().then((nonPersonalizedAds) => {
      expect(nonPersonalizedAds).to.equal(0);
    });
  });

  it('should return nonPersonalizedAds 1 if not all purposeConsents are given', () => {
    const cmp = new CMP(dom.window);
    dom.window.__cmp = cmpStub;
    addStubBehaviour(0, { cmpLoaded: true });
    addStubBehaviour(1, {
      gdprApplies: true,
      purposeConsents: {
        1: true,
        2: true,
        3: false,
        4: true,
        5: true
      }
    });

    return cmp.getNonPersonalizedAdSetting().then((nonPersonalizedAds) => {
      expect(nonPersonalizedAds).to.equal(1);
    });
  });
});
