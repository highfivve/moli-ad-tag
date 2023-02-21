import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';

import { Confiant } from './index';
import { emptyConfig, newEmptyConfig, noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import {
  AdPipelineContext,
  AssetLoadMethod,
  createAssetLoaderService,
  googletag
} from '@highfivve/ad-tag';
import { fullConsent, tcDataNoGdpr } from '@highfivve/ad-tag/lib/stubs/consentStubs';

// setup sinon-chai
use(sinonChai);

describe('Confiant Module', () => {
  const sandbox = Sinon.createSandbox();
  const dom = createDom();
  const jsDomWindow: Window & googletag.IGoogleTagWindow = dom.window as any;

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  const createConfiant = (): Confiant =>
    new Confiant({
      assetUrl: 'http://localhost/confiant.js'
    });

  beforeEach(() => {
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should add an init step', async () => {
    const module = createConfiant();
    const config = newEmptyConfig();

    module.init(config, assetLoaderService);

    expect(config.pipeline).to.be.ok;
    expect(config.pipeline?.initSteps).to.have.length(1);
    expect(config.pipeline?.initSteps[0].name).to.be.eq('confiant');
  });

  describe('loadConfiant', () => {
    const module = createConfiant();
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
        tcData: fullConsent({ 56: true })
      };
    };

    it('not load anything in a test environment', () => {
      module.loadConfiant({ ...adPipelineContext(), env: 'test' }, assetLoaderService);
      expect(loadScriptStub).to.have.not.been.called;
    });

    it('not load anything if gdpr applies and vendor 56 has no consent', () => {
      module.loadConfiant(
        { ...adPipelineContext(), tcData: fullConsent({ 56: false }) },
        assetLoaderService
      );
      expect(loadScriptStub).to.have.not.been.called;
    });

    it('load confiant if gdpr does not apply', () => {
      module.loadConfiant({ ...adPipelineContext(), tcData: tcDataNoGdpr }, assetLoaderService);
      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: module.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: 'http://localhost/confiant.js'
      });
    });

    it('load confiant if gdpr does apply', () => {
      module.loadConfiant(adPipelineContext(), assetLoaderService);
      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: module.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: 'http://localhost/confiant.js'
      });
    });
  });
});
