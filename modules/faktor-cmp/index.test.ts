import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import Faktor from './index';
import { createDom } from '@highfivve/ad-tag/tests/ts/stubs/browserEnvSetup';
import { Moli } from '@highfivve/ad-tag';


// setup sinon-chai
use(sinonChai);


// tslint:disable: no-unused-expression
describe('Faktor CMP Module', () => {

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
    const module = new Faktor({ autoOptIn: false }, dom.window);

    module.init(config, {} as any);
    expect((dom.window as any).__cmp).to.be.ok;
  });

  it('should add itself as a cmp module', () => {
    const config = emptyConfig();
    const module = new Faktor({ autoOptIn: false }, dom.window);

    expect(config.consent.cmp).to.be.undefined;
    module.init(config, {} as any);
    expect(config.consent.cmp).to.be.ok;
    expect(config.consent.cmp!.name).to.be.equals('faktor-cmp');
  });

  it('should not call acceptAll if consent data exists', () => {
    dom.window.__cmp = cmpStub;
    addStubBehaviour(0);
    addStubBehaviour(1, true);
    const faktorCmp = new Faktor({ autoOptIn: true }, dom.window);

    return faktorCmp.getFaktorLoaded().then(() => {
      expect(cmpStub.callCount).to.equal(2);
      expect(cmpStub.secondCall.args[0]).to.equal('consentDataExist');
      expect(cmpStub.secondCall.args[1]).to.equal(true);
    });
  });

  it('should call acceptAll if no consent data exists', () => {
    dom.window.__cmp = cmpStub;
    addStubBehaviour(0);
    addStubBehaviour(1, false);
    addStubBehaviour(2);
    const faktorCmp = new Faktor({ autoOptIn: true }, dom.window);

    return faktorCmp.getFaktorLoaded().then(() => {
      expect(cmpStub.callCount).to.equal(3);
      expect(cmpStub.secondCall.args[0]).to.equal('consentDataExist');
      expect(cmpStub.secondCall.args[1]).to.equal(true);
      expect(cmpStub.thirdCall.args[0]).to.equal('acceptAll');
      expect(cmpStub.thirdCall.args[1]).to.equal(true);
    });
  });

  it('should return nonPersonalizedAds 0 if all gdpr does not apply', () => {
    dom.window.__cmp = cmpStub;
    addStubBehaviour(0);
    addStubBehaviour(1, {
      gdprApplies: false
    });
    const faktorCmp = new Faktor({ autoOptIn: false }, dom.window);

    return faktorCmp.getNonPersonalizedAdSetting().then((nonPersonalizedAds) => {
      expect(nonPersonalizedAds).to.equal(0);
    });
  });

  it('should return nonPersonalizedAds 0 if all purposeConsents are given', () => {
    dom.window.__cmp = cmpStub;
    addStubBehaviour(0);
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
    const faktorCmp = new Faktor({ autoOptIn: false }, dom.window);

    return faktorCmp.getNonPersonalizedAdSetting().then((nonPersonalizedAds) => {
      expect(nonPersonalizedAds).to.equal(0);
    });
  });

  it('should return nonPersonalizedAds 1 if not all purposeConsents are given', () => {
    dom.window.__cmp = cmpStub;
    addStubBehaviour(0);
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
    const faktorCmp = new Faktor({ autoOptIn: false }, dom.window);

    return faktorCmp.getNonPersonalizedAdSetting().then((nonPersonalizedAds) => {
      expect(nonPersonalizedAds).to.equal(1);
    });
  });
});
