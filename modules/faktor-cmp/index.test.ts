import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import Faktor from './index';
import { createDom } from '@highfivve/ad-tag/tests/ts/stubs/browserEnvSetup';
import { Moli } from '@highfivve/ad-tag';
import { AssetLoadMethod, createAssetLoaderService } from '@highfivve/ad-tag/source/ts/util/assetLoaderService';


// setup sinon-chai
use(sinonChai);


// tslint:disable: no-unused-expression
describe('Faktor CMP Module', () => {

  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let assetLoaderService = createAssetLoaderService(dom.window);

  const emptyConfig = (): Moli.MoliConfig => {
    return { slots: [], consent: {}, yieldOptimization: { provider: 'none' } };
  };

  const cmpStub = sandbox.stub();
  const addStubBehaviour = (onCall: number, returnValue?: any) => {
    cmpStub.onCall(onCall).callsFake((command, param, callback) => callback(returnValue));
  };

  afterEach(() => {
    dom = createDom();
    assetLoaderService = createAssetLoaderService(dom.window);
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

  it('should call acceptAll and showConsentManager if no consent data exists', () => {
    dom.window.__cmp = cmpStub;
    addStubBehaviour(0);
    // consentDataExists
    addStubBehaviour(1, false);
    // acceptAll
    addStubBehaviour(2);
    // showConsentManager
    addStubBehaviour(3);
    const faktorCmp = new Faktor({ autoOptIn: true }, dom.window);

    return faktorCmp.getFaktorLoaded().then(() => {
      expect(cmpStub.callCount).to.equal(4);
      expect(cmpStub.secondCall.args[0]).to.equal('consentDataExist');
      expect(cmpStub.secondCall.args[1]).to.equal(true);
      expect(cmpStub.thirdCall.args[0]).to.equal('acceptAll');
      expect(cmpStub.thirdCall.args[1]).to.equal(true);
      const fourthCall = cmpStub.getCall(3);
      expect(fourthCall.args[0]).to.equal('showConsentTool');
      expect(fourthCall.args[1]).to.equal(true);
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

  describe('faktor site config', () => {

    beforeEach(() => {
      dom.window.__cmp = cmpStub;
      // always resolve with an empty object. This is enough to make things work
      cmpStub.callsFake((command, param, callback) => callback({}));
    });

    it('should immediately load the fakor.js in eager mode', () => {
      const faktorCmp = new Faktor({
        autoOptIn: false, site: {
          mode: 'eager',
          url: 'https://localhost/faktor.js'
        }
      }, dom.window);

      const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript').resolves();
      faktorCmp.init(emptyConfig(), assetLoaderService);

      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: 'faktor.js', assetUrl: 'https://localhost/faktor.js', loadMethod: AssetLoadMethod.TAG
      });

      // all other calls should never fetch the script
      return faktorCmp.getNonPersonalizedAdSetting()
        .then(() => faktorCmp.getConsentData())
        .then(() => faktorCmp.getVendorConsents())
        .then(() => expect(loadScriptStub).to.have.been.calledOnce);
    });

    it('should load the fakor.js on the first API call in eager lazy', () => {
      const faktorCmp = new Faktor({
        autoOptIn: false, site: {
          mode: 'lazy',
          url: 'https://localhost/faktor.js'
        }
      }, dom.window);

      const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript').resolves();
      faktorCmp.init(emptyConfig(), assetLoaderService);

      expect(loadScriptStub).to.have.not.been.called;

      // all other calls should never fetch the script
      return faktorCmp.getNonPersonalizedAdSetting()
        .then(() => {
          expect(loadScriptStub).to.have.been.calledOnce;
          expect(loadScriptStub).to.have.been.calledOnceWithExactly({
            name: 'faktor.js', assetUrl: 'https://localhost/faktor.js', loadMethod: AssetLoadMethod.TAG
          });
        })
        .then(() => faktorCmp.getNonPersonalizedAdSetting())
        .then(() => faktorCmp.getConsentData())
        .then(() => faktorCmp.getVendorConsents())
        .then(() => expect(loadScriptStub).to.have.been.calledOnce);
    });
  });
});
