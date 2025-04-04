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
    module.configure(modulesConfig);
    const initSteps = module.initSteps();

    expect(initSteps).to.have.length(1);
    expect(initSteps[0].name).to.be.eq('identitylink');
  });

  describe('loadAts', () => {
    const module = createIdentityLink();
    const adPipelineContext = (): AdPipelineContext => {
      return {
        auctionId: 'xxxx-xxxx-xxxx-xxxx',
        requestId: 0,
        requestAdsCalls: 1,
        env: 'production',
        logger: noopLogger,
        config: emptyConfig,
        window: jsDomWindow as any,
        // no service dependencies required
        labelConfigService: null as any,
        runtimeConfig: emptyRuntimeConfig,
        tcData: fullConsent({ 97: true }),
        adUnitPathVariables: {},
        auction: newGlobalAuctionContext(jsDomWindow),
        assetLoaderService: assetLoaderService
      };
    };

    it('not load anything in a test environment', async () => {
      await module.loadAts({ ...adPipelineContext(), env: 'test' }, identityLinkConfig);
      expect(loadScriptStub).to.have.not.been.called;
    });

    it('not load anything if gdpr applies and vendor 97 has no consent', async () => {
      await module.loadAts(
        { ...adPipelineContext(), tcData: fullConsent({ 97: false }) },
        identityLinkConfig
      );
      expect(loadScriptStub).to.have.not.been.called;
    });

    [adPipelineContext(), { ...adPipelineContext(), tcData: tcDataNoGdpr }].forEach(context =>
      it(`load ats if gdpr ${
        context.tcData.gdprApplies ? 'applies' : 'does not apply'
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
