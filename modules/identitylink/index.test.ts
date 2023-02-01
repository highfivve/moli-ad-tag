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
import { AdPipelineContext } from '@highfivve/ad-tag';
import { fullConsent, tcDataNoGdpr } from '@highfivve/ad-tag/lib/stubs/consentStubs';

// setup sinon-chai
use(sinonChai);

describe('IdentityLink Module', () => {
  const sandbox = Sinon.createSandbox();
  const dom = createDom();
  const jsDomWindow: ATS.ATSWindow = dom.window as any;
  const atsStartStub = sandbox.stub();

  jsDomWindow.ats = {
    retrieveEnvelope: sandbox.stub(),
    start: atsStartStub,
    triggerDetection: sandbox.stub()
  };

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  const createIdentityLink = (): IdentityLink =>
    new IdentityLink(
      {
        assetUrl: 'http://localhost/ats.js',
        hashedEmailAddresses: ['somehashedaddress'],
        placementId: 1337,
        pixelId: 42
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
        tcData: fullConsent({ 97: true })
      };
    };

    it('not load anything in a test environment', async () => {
      await module.loadAts({ ...adPipelineContext(), env: 'test' }, assetLoaderService);
      expect(loadScriptStub).to.have.not.been.called;
    });

    it('not load anything if gdpr applies and vendor 56 has no consent', async () => {
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

        expect(loadScriptStub).to.have.been.calledOnceWithExactly({
          name: module.name,
          loadMethod: AssetLoadMethod.TAG,
          assetUrl: 'http://localhost/ats.js'
        });

        expect(atsStartStub).to.have.been.calledOnceWithExactly({
          placementID: 1337,
          pixelID: 42,
          storageType: 'localStorage',
          emailHashes: ['somehashedaddress'],
          logging: 'error'
        });
      })
    );
  });
});
