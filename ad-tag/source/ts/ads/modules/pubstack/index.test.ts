import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { Pubstack } from './index';
import { GlobalAuctionContext } from 'ad-tag/ads/globalAuctionContext';
import { AssetLoadMethod, createAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import {
  emptyConfig,
  emptyRuntimeConfig,
  newEmptyConfig,
  noopLogger
} from 'ad-tag/stubs/moliStubs';
import { createDom } from 'ad-tag/stubs/browserEnvSetup';
import { createGoogletagStub } from 'ad-tag/stubs/googletagStubs';
import { fullConsent } from 'ad-tag/stubs/consentStubs';
import { modules } from 'ad-tag/types/moliConfig';

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
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript').resolves();

  const adPipelineContext = (): AdPipelineContext => {
    return {
      auctionId: 'xxxx-xxxx-xxxx-xxxx',
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: noopLogger,
      config: emptyConfig,
      runtimeConfig: emptyRuntimeConfig,
      window: jsDomWindow as any,
      // no service dependencies required
      labelConfigService: null as any,
      tcData: fullConsent(),
      adUnitPathVariables: {},
      auction: new GlobalAuctionContext(jsDomWindow as any),
      assetLoaderService: assetLoaderService
    };
  };

  const modulesConfig: modules.ModulesConfig = {
    pubstack: {
      enabled: true,
      tagId: '1234-5678-910a'
    }
  };
  const createPubstack = (): Pubstack => new Pubstack();

  beforeEach(() => {
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('init step', () => {
    it('should add an init step', async () => {
      const module = createPubstack();
      module.configure(modulesConfig);
      const initSteps = module.initSteps();

      expect(initSteps).to.have.length(1);
      expect(initSteps[0].name).to.be.eq('pubstack-init');
    });

    it('should load script in init step', async () => {
      const module = createPubstack();
      module.configure(modulesConfig);

      const init = module.initSteps()[0];
      expect(init).to.be.ok;

      await init(adPipelineContext());

      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: module.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: 'https://boot.pbstck.com/v1/tag/1234-5678-910a'
      });

      it('should not load script in init step if env is test', async () => {
        const module = createPubstack();

        const init = module.initSteps()[0];
        expect(init).to.be.ok;

        await init({ ...adPipelineContext(), env: 'test' });
        expect(loadScriptStub).to.have.not.been.called;
      });
    });
  });

  describe('prepareRequestAds step', () => {
    it('should not add a prepareRequestAds step', () => {
      const module = createPubstack();
      module.configure(modulesConfig);
      const prepareRequestAdsSteps = module.prepareRequestAdsSteps();

      expect(prepareRequestAdsSteps).to.have.length(0);
    });
  });

  describe('ab test feature', () => {
    const callConfigureStep = async (env: 'production' | 'test' = 'production') => {
      const module = createPubstack();
      module.configure(modulesConfig);

      const configureSteps = module.configureSteps();

      expect(configureSteps).to.have.length(1);
      const step = configureSteps[0]!;
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
