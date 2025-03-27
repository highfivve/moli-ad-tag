import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import {
  AssetLoadMethod,
  createAssetLoaderService
} from '@highfivve/ad-tag/source/ts/util/assetLoaderService';
import { ATS } from './types/identitylink';

import { IdentityLink } from './index';
import { emptyConfig, newEmptyConfig, noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { AdPipelineContext, googletag, prebidjs } from '@highfivve/ad-tag';
import { fullConsent, tcDataNoGdpr } from '@highfivve/ad-tag/lib/stubs/consentStubs';
import { GlobalAuctionContext } from '@highfivve/ad-tag/lib/ads/globalAuctionContext';
import { EventService } from '@highfivve/ad-tag/lib/ads/eventService';

// setup sinon-chai
use(sinonChai);

describe('IdentityLink Module', () => {
  const sandbox = Sinon.createSandbox();
  const dom = createDom();
  const jsDomWindow: Window &
    googletag.IGoogleTagWindow &
    prebidjs.IPrebidjsWindow &
    ATS.ATSWindow &
    Pick<typeof globalThis, 'Date'> = dom.window as any;
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

  const createIdentityLink = (): IdentityLink =>
    new IdentityLink(
      {
        hashedEmailAddresses: ['somehashedaddress'],
        launchPadId: 'aaaa-bbbb-0000-cccc'
      },
      jsDomWindow
    );

  beforeEach(() => {
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should add an init step', async () => {
    const module = createIdentityLink();
    const config = newEmptyConfig();

    module.init(config, assetLoaderService);

    expect(config.pipeline).to.be.ok;
    expect(config.pipeline?.initSteps).to.have.length(1);
    expect(config.pipeline?.initSteps[0].name).to.be.eq('identitylink');
  });

  describe('loadAts', () => {
    const module = createIdentityLink();
    const adPipelineContext = (): AdPipelineContext => {
      return {
        requestId: 0,
        requestAdsCalls: 1,
        env: 'production',
        logger: noopLogger,
        config: emptyConfig,
        window: jsDomWindow as any,
        // no service dependencies required
        labelConfigService: null as any,
        reportingService: null as any,
        tcData: fullConsent({ 97: true }),
        adUnitPathVariables: {},
        auction: new GlobalAuctionContext(jsDomWindow, noopLogger, new EventService())
      };
    };

    it('not load anything in a test environment', async () => {
      await module.loadAts({ ...adPipelineContext(), env: 'test' }, assetLoaderService);
      expect(loadScriptStub).to.have.not.been.called;
    });

    it('not load anything if gdpr applies and vendor 97 has no consent', async () => {
      await module.loadAts(
        { ...adPipelineContext(), tcData: fullConsent({ 97: false }) },
        assetLoaderService
      );
      expect(loadScriptStub).to.have.not.been.called;
    });

    [adPipelineContext(), { ...adPipelineContext(), tcData: tcDataNoGdpr }].forEach(context =>
      it(`load ats if gdpr ${
        context.tcData.gdprApplies ? 'applies' : 'does not apply'
      }`, async () => {
        await module.loadAts(context, assetLoaderService);

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
