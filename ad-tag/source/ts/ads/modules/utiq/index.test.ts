import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { modules } from 'ad-tag/types/moliConfig';
import { tcfapi } from 'ad-tag/types/tcfapi';
import { AssetLoadMethod, createAssetLoaderService } from 'ad-tag/util/assetLoaderService';

import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import {
  emptyConfig,
  emptyRuntimeConfig,
  newGlobalAuctionContext,
  noopLogger
} from 'ad-tag/stubs/moliStubs';
import { fullConsent, tcDataNoGdpr } from 'ad-tag/stubs/consentStubs';
import { createUtiq } from './index';

// setup sinon-chai
use(sinonChai);

describe('Utiq Module', () => {
  const sandbox = Sinon.createSandbox();
  const { jsDomWindow } = createDomAndWindow();

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  const createUtiqModule = (
    enabled: boolean = true,
    options?: modules.utiq.UtiqConfigOptions,
    delay?: modules.utiq.UtiqConfig['delay']
  ) => {
    const module = createUtiq();
    module.configure__({
      utiq: {
        enabled: enabled,
        assetUrl: 'http://localhost/utiqLoader.js',
        ...(delay ? { delay: delay } : {}),
        ...(options ? { options: options } : {})
      }
    });
    return {
      module,
      initStep: module.initSteps__()[0],
      configureStep: module.configureSteps__()[0]
    };
  };

  beforeEach(() => {
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('pipeline steps', () => {
    it('should add an init step if enabled and no delay config', async () => {
      const { initStep, configureStep } = createUtiqModule();

      expect(initStep).to.be.ok;
      expect(initStep.name).to.be.eq('utiq');
      expect(configureStep).to.be.undefined;
    });

    it('should add an init step if enabled and delay config is disabled', async () => {
      const { initStep, configureStep } = createUtiqModule(true, undefined, { enabled: false });

      expect(initStep).to.be.ok;
      expect(initStep.name).to.be.eq('utiq');
      expect(configureStep).to.be.undefined;
    });

    it('should add a configure step if enabled and delay config is enabled', async () => {
      const { initStep, configureStep } = createUtiqModule(true, undefined, { enabled: true });

      expect(initStep).to.be.undefined;
      expect(configureStep).to.be.ok;
      expect(configureStep.name).to.be.eq('utiq');
    });
  });

  describe('loadUtiq', () => {
    const adPipelineContext = (requestAdsCalls: number = 1): AdPipelineContext => {
      const mockAuctionContext = newGlobalAuctionContext(jsDomWindow);
      // Mock the hasMinimumRequestAds method to simulate the expected behavior
      sandbox
        .stub(mockAuctionContext, 'hasMinimumRequestAds')
        .callsFake((minAdRequests: number) => {
          return requestAdsCalls >= minAdRequests;
        });

      return {
        auctionId__: 'xxxx-xxxx-xxxx-xxxx',
        requestId__: 0,
        requestAdsCalls__: requestAdsCalls,
        env__: 'production',
        logger__: noopLogger,
        config__: emptyConfig,
        runtimeConfig__: emptyRuntimeConfig,
        window__: jsDomWindow,
        // no service dependencies required
        labelConfigService__: null as any,
        tcData__: fullConsent({ 56: true }),
        adUnitPathVariables__: {},
        auction__: mockAuctionContext,
        assetLoaderService__: assetLoaderService
      };
    };

    it('not load anything in a test environment', async () => {
      const { initStep } = createUtiqModule();
      await initStep({ ...adPipelineContext(), env__: 'test' });
      expect(loadScriptStub).to.have.not.been.called;
    });

    [
      tcfapi.responses.TCPurpose.STORE_INFORMATION_ON_DEVICE,
      tcfapi.responses.TCPurpose.SELECT_BASIC_ADS,
      tcfapi.responses.TCPurpose.CREATE_PERSONALISED_ADS_PROFILE,
      tcfapi.responses.TCPurpose.SELECT_PERSONALISED_ADS,
      tcfapi.responses.TCPurpose.CREATE_PERSONALISED_CONTENT_PROFILE,
      tcfapi.responses.TCPurpose.SELECT_PERSONALISED_CONTENT,
      tcfapi.responses.TCPurpose.MEASURE_AD_PERFORMANCE,
      tcfapi.responses.TCPurpose.MEASURE_CONTENT_PERFORMANCE,
      tcfapi.responses.TCPurpose.APPLY_MARKET_RESEARCH,
      tcfapi.responses.TCPurpose.DEVELOP_IMPROVE_PRODUCTS,
      tcfapi.responses.TCPurpose.USE_LIMITED_DATA_TO_SElECT_CONTENT
    ].forEach(purposeId => {
      it(`not load anything if gdpr applies and purpose ${purposeId} is missing`, async () => {
        const { initStep } = createUtiqModule();
        const tcDataFullConsent = fullConsent();
        await initStep({
          ...adPipelineContext(),
          tcData__: {
            ...tcDataFullConsent,
            purpose: {
              ...tcDataFullConsent.purpose,
              consents: { ...tcDataFullConsent.purpose.consents, [purposeId]: false }
            }
          }
        });
        expect(loadScriptStub).to.have.not.been.called;
      });
    });

    it('load utiq if gdpr does not apply', async () => {
      const { module, initStep } = createUtiqModule();
      await initStep({ ...adPipelineContext(), tcData__: tcDataNoGdpr });
      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: module.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: 'http://localhost/utiqLoader.js'
      });
    });

    it('load utiq if gdpr does apply and consent for all 11 purposes is given', async () => {
      const { module, initStep } = createUtiqModule();
      await initStep(adPipelineContext());
      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: module.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: 'http://localhost/utiqLoader.js'
      });
      expect((jsDomWindow as any).Utiq.queue).to.be.deep.equal([]);
    });

    it('should load utiq script only once', async () => {
      const { initStep } = createUtiqModule();
      await initStep(adPipelineContext());
      expect(loadScriptStub).to.have.been.calledOnce;

      // call again, should not load again
      await initStep(adPipelineContext());
      expect(loadScriptStub).to.have.been.calledOnce;
    });

    describe('delay with minAdRequests', () => {
      it('should not load utiq if minAdRequest requirement is not met', async () => {
        const { configureStep } = createUtiqModule(true, undefined, {
          enabled: true,
          minAdRequests: 2
        });
        await configureStep(adPipelineContext(1), []);
        expect(loadScriptStub).to.have.not.been.called;
      });

      it('should load utiq if minAdRequest requirement is met', async () => {
        const { configureStep } = createUtiqModule(true, undefined, {
          enabled: true,
          minAdRequests: 1
        });
        await configureStep(adPipelineContext(1), []);
        expect(loadScriptStub).to.have.been.calledOnce;
      });
    });
  });
});
