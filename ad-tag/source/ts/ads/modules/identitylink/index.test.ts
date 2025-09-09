import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { AssetLoadMethod, createAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { modules } from 'ad-tag/types/moliConfig';
import { ATS } from 'ad-tag/types/identitylink';
import { IdentityLink } from 'ad-tag/ads/modules/identitylink/index';
import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import {
  emptyConfig,
  emptyRuntimeConfig,
  newGlobalAuctionContext,
  noopLogger
} from 'ad-tag/stubs/moliStubs';
import { fullConsent, tcDataNoGdpr } from 'ad-tag/stubs/consentStubs';
import { createDom } from 'ad-tag/stubs/browserEnvSetup';

// setup sinon-chai
use(sinonChai);

describe('IdentityLink Module', () => {
  const sandbox = Sinon.createSandbox();
  const dom = createDom();
  const jsDomWindow: ATS.ATSWindow = dom.window as any;
  const envelopeModuleSetAdditionalDataStub = sandbox.stub();
  const addEventListerSpy = sandbox.spy(jsDomWindow, 'addEventListener');

  jsDomWindow.ats = {
    setAdditionalData: sandbox.stub,
    retrieveEnvelope: sandbox.stub(),
    triggerDetection: sandbox.stub(),
    invalidateEnvelope: sandbox.stub(),
    outputCurrentConfiguration: sandbox.stub()
  };
  jsDomWindow.atsenvelopemodule = {
    setAdditionalData: envelopeModuleSetAdditionalDataStub,
    retrieveEnvelope: sandbox.stub(),
    triggerDetection: sandbox.stub(),
    invalidateEnvelope: sandbox.stub(),
    outputCurrentConfiguration: sandbox.stub()
  };

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  const createIdentityLink = (): IdentityLink => new IdentityLink();
  const identityLinkConfig: modules.identitylink.IdentityLinkModuleConfig = {
    enabled: true,
    hashedEmailAddresses: ['somehashedaddress'],
    launchPadId: 'aaaa-bbbb-0000-cccc'
  };
  const modulesConfig: modules.ModulesConfig = {
    identitylink: {
      ...identityLinkConfig
    }
  };

  beforeEach(() => {
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should add an init step', async () => {
    const module = createIdentityLink();
    module.configure__(modulesConfig);
    const initSteps = module.initSteps__();

    expect(initSteps).to.have.length(1);
    expect(initSteps[0].name).to.be.eq('identitylink');
  });

  describe('loadAts', () => {
    const module = createIdentityLink();
    const adPipelineContext = (): AdPipelineContext => {
      return {
        auctionId__: 'xxxx-xxxx-xxxx-xxxx',
        requestId__: 0,
        requestAdsCalls__: 1,
        env__: 'production',
        logger__: noopLogger,
        config__: emptyConfig,
        window__: jsDomWindow as any,
        // no service dependencies required
        labelConfigService__: null as any,
        runtimeConfig__: emptyRuntimeConfig,
        tcData__: fullConsent({ 97: true }),
        adUnitPathVariables__: {},
        auction__: newGlobalAuctionContext(jsDomWindow),
        assetLoaderService__: assetLoaderService
      };
    };

    it('not load anything in a test environment', async () => {
      await module.loadAts({ ...adPipelineContext(), env__: 'test' }, identityLinkConfig);
      expect(loadScriptStub).to.have.not.been.called;
    });

    it('not load anything if gdpr applies and vendor 97 has no consent', async () => {
      await module.loadAts(
        { ...adPipelineContext(), tcData__: fullConsent({ 97: false }) },
        identityLinkConfig
      );
      expect(loadScriptStub).to.have.not.been.called;
    });

    [adPipelineContext(), { ...adPipelineContext(), tcData__: tcDataNoGdpr }].forEach(context =>
      it(`load ats if gdpr ${
        context.tcData__.gdprApplies ? 'applies' : 'does not apply'
      }`, async () => {
        await module.loadAts(context, identityLinkConfig);

        expect(addEventListerSpy).to.have.been.calledOnce;
        expect(envelopeModuleSetAdditionalDataStub).to.have.not.been.called;

        expect(loadScriptStub).to.have.been.calledOnceWithExactly({
          name: module.name,
          loadMethod: AssetLoadMethod.TAG,
          assetUrl:
            'https://launchpad-wrapper.privacymanager.io/aaaa-bbbb-0000-cccc/launchpad-liveramp.js'
        });

        const [event, callback] = addEventListerSpy.firstCall.args;
        expect(event).to.be.eq('envelopeModuleReady');

        // fire callback
        (callback as any)();

        expect(envelopeModuleSetAdditionalDataStub).to.have.been.calledOnce;

        expect(envelopeModuleSetAdditionalDataStub).to.have.been.calledOnceWithExactly({
          type: 'emailHashes',
          id: ['somehashedaddress']
        });
      })
    );
  });
});
