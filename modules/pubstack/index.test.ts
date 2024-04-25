import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import { createGoogletagStub } from '@highfivve/ad-tag/lib/stubs/googletagStubs';
import { emptyConfig, newEmptyConfig, noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { fullConsent } from '@highfivve/ad-tag/lib/stubs/consentStubs';

import { Pubstack } from './index';
import { AdPipelineContext, AssetLoadMethod, createAssetLoaderService } from '@highfivve/ad-tag';
import { GlobalAuctionContext } from '@highfivve/ad-tag/lib/ads/globalAuctionContext';

// setup sinon-chai
use(sinonChai);

describe('Pubstack Module', () => {
  const sandbox = Sinon.createSandbox();
  const dom = createDom();
  const jsDomWindow: Window = dom.window as any;

  const googletagStub = createGoogletagStub();
  const setTargetingSpy = sandbox.spy(googletagStub.pubads(), 'setTargeting');

  dom.window.googletag = googletagStub;

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

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
      tcData: fullConsent(),
      adUnitPathVariables: {},
      auction: new GlobalAuctionContext(jsDomWindow as any)
    };
  };

  const createPubstack = (): Pubstack =>
    new Pubstack({
      tagId: '1234-5678-910a'
    });

  beforeEach(() => {
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should add an init step', async () => {
    const module = createPubstack();
    const config = newEmptyConfig();

    module.init(config, assetLoaderService);

    expect(config.pipeline).to.be.ok;
    expect(config.pipeline?.initSteps).to.have.length(1);
    expect(config.pipeline?.initSteps[0].name).to.be.eq('pubstack-init');
  });

  it('should load script in init step', async () => {
    const module = createPubstack();
    const config = newEmptyConfig();

    module.init(config, assetLoaderService);
    const init = config.pipeline?.initSteps[0]!;

    expect(config.pipeline).to.be.ok;

    await init(adPipelineContext());
    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: 'https://boot.pbstck.com/v1/tag/1234-5678-910a'
    });

    it('should not load script in init step if env is test', async () => {
      const module = createPubstack();
      const config = newEmptyConfig();

      module.init(config, assetLoaderService);
      const init = config.pipeline?.initSteps[0]!;

      expect(config.pipeline).to.be.ok;

      await init({ ...adPipelineContext(), env: 'test' });
      expect(loadScriptStub).to.have.not.been.called;
    });
  });

  describe('ab test feature', () => {
    const callConfigureStep = async (env: 'production' | 'test' = 'production') => {
      const module = createPubstack();
      const config = newEmptyConfig();

      module.init(config, assetLoaderService);
      expect(config.pipeline).to.be.ok;
      expect(config.pipeline?.configureSteps).to.have.length(1);
      const step = config.pipeline?.configureSteps[0]!;
      expect(step.name).to.be.eq('pubstack-configure');

      await step({ ...adPipelineContext(), env }, []);
    };

    const addMetaTag = (content: string): void => {
      const metaTag = dom.window.document.createElement('meta');
      metaTag.name = 'pbstck_context:pbstck_ab_test';
      metaTag.content = content;
      dom.window.document.head.appendChild(metaTag);
    };

    beforeEach(() => {
      dom.window.document.head.replaceChildren();
    });

    it('should do nothing if the meta tag is missing', async () => {
      await callConfigureStep();
      expect(setTargetingSpy).to.have.not.been.called;
    });

    ['-1', '4', '5', 'five', 'true', 'false'].forEach(content => {
      it(`should ignore invalid value "${content}"`, async () => {
        addMetaTag(content);
        await callConfigureStep();
        expect(setTargetingSpy).to.have.not.been.called;
      });
    });

    ['0', '1', '2', '3'].forEach(content => {
      it(`should set pubstack key value with "${content}"`, async () => {
        addMetaTag(content);
        await callConfigureStep();
        expect(setTargetingSpy).to.have.been.called;
      });

      it(`should do nothing if env is test with valid value ${content}`, async () => {
        addMetaTag(content);
        await callConfigureStep('test');
        expect(setTargetingSpy).to.have.not.been.called;
      });
    });
  });
});
