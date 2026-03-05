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
    const initSteps = module.initSteps__();
    const configureSteps = module.configureSteps__();

    return {
      module,
      initStep: initSteps.length > 0 ? initSteps[0] : undefined,
      configureStep: configureSteps.length > 0 ? configureSteps[0] : undefined,
      prepareRequestAdsStep: undefined // No longer used
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
      expect(initStep!.name).to.be.eq('utiq');
      expect(configureStep).to.be.undefined; // No configure step for non-delayed UTIQ
    });

    it('should add an init step if enabled and delay config is disabled', async () => {
      const { initStep, configureStep } = createUtiqModule(true, undefined, { enabled: false });

      expect(initStep).to.be.ok;
      expect(initStep!.name).to.be.eq('utiq');
      expect(configureStep).to.be.undefined; // No configure step for non-delayed UTIQ
    });

    it('should add a configureStep if enabled and delay config is enabled', async () => {
      const { initStep, configureStep } = createUtiqModule(true, undefined, {
        enabled: true
      });

      expect(initStep).to.be.undefined;
      expect(configureStep).to.be.ok;
      expect(configureStep!.name).to.be.eq('utiq');
    });
  });

  describe('loadUtiq', () => {
    const adPipelineContext = (requestAdsCalls: number = 1): AdPipelineContext => {
      const mockAuctionContext = newGlobalAuctionContext(jsDomWindow);
      // Mock the hasMinimumPageImpressions method to simulate the expected behavior
      sandbox
        .stub(mockAuctionContext, 'hasMinimumRequestAds')
        .callsFake((minAdRequests: number) => {
          const completedRequests = requestAdsCalls - 1;
          return completedRequests + 1 >= minAdRequests;
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
      await initStep!({ ...adPipelineContext(), env__: 'test' });
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
        await initStep!({
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
      await initStep!({ ...adPipelineContext(), tcData__: tcDataNoGdpr });
      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: module.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: 'http://localhost/utiqLoader.js'
      });
    });

    it('load utiq if gdpr does apply and consent for all 11 purposes is given', async () => {
      const { module, initStep } = createUtiqModule();
      await initStep!(adPipelineContext());
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
      await initStep!(adPipelineContext());
      expect(loadScriptStub).to.have.been.calledOnce;

      // call again, should not load again
      await initStep!(adPipelineContext());
      expect(loadScriptStub).to.have.been.calledOnce;
    });

    describe('delay with minAdRequests', () => {
      it('should not load utiq if minAdRequest requirement is not met', async () => {
        const { configureStep } = createUtiqModule(true, undefined, {
          enabled: true,
          minAdRequests: 2
        });
        await configureStep!(adPipelineContext(1), []);
        expect(loadScriptStub).to.have.not.been.called;
      });

      it('should load utiq if minAdRequest requirement is met', async () => {
        const { configureStep } = createUtiqModule(true, undefined, {
          enabled: true,
          minAdRequests: 1
        });
        await configureStep!(adPipelineContext(1), []);
        expect(loadScriptStub).to.have.been.calledOnce;
      });
    });

    describe('SPA with delayed utiq loading', () => {
      it('should load utiq script in SPA when delay requirement is met across multiple requestAds cycles', async () => {
        const { module, configureStep } = createUtiqModule(true, undefined, {
          enabled: true,
          minAdRequests: 3
        });

        // First requestAds call - requirement not met (1 < 3)
        const firstContext = adPipelineContext(1);
        await configureStep!(firstContext, []);
        expect(loadScriptStub).to.have.not.been.called;

        // Second requestAds call - requirement still not met (2 < 3)
        const secondContext = adPipelineContext(2);
        await configureStep!(secondContext, []);
        expect(loadScriptStub).to.have.not.been.called;

        // Third requestAds call - requirement now met (3 >= 3)
        const thirdContext = adPipelineContext(3);
        await configureStep!(thirdContext, []);
        expect(loadScriptStub).to.have.been.calledOnce;
        expect(loadScriptStub).to.have.been.calledOnceWithExactly({
          name: module.name,
          loadMethod: AssetLoadMethod.TAG,
          assetUrl: 'http://localhost/utiqLoader.js'
        });
      });

      it('should not load utiq script twice even when called multiple times after requirement is met', async () => {
        const { configureStep } = createUtiqModule(true, undefined, {
          enabled: true,
          minAdRequests: 2
        });

        // First call - requirement met, script loads
        const firstContext = adPipelineContext(2);
        await configureStep!(firstContext, []);
        expect(loadScriptStub).to.have.been.calledOnce;

        // Second call - should not load again due to scriptLoaded flag
        const secondContext = adPipelineContext(3);
        await configureStep!(secondContext, []);
        expect(loadScriptStub).to.have.been.calledOnce;

        // Third call - should still not load again
        const thirdContext = adPipelineContext(4);
        await configureStep!(thirdContext, []);
        expect(loadScriptStub).to.have.been.calledOnce;
      });
    });
  });

  describe('Emetriq integration', () => {
    const createUtiqModuleWithEmetriq = (
      enabled: boolean = true,
      emetriqSid: string = '29540',
      options?: modules.utiq.UtiqConfigOptions,
      delay?: modules.utiq.UtiqConfig['delay']
    ) => {
      const module = createUtiq();
      module.configure__({
        utiq: {
          enabled: enabled,
          assetUrl: 'http://localhost/utiqLoader.js',
          ...(delay ? { delay: delay } : {}),
          ...(options ? { options: options } : {}),
          userIdConfig: {
            emetriq: {
              sid: emetriqSid
            }
          }
        }
      });
      const initSteps = module.initSteps__();
      const configureSteps = module.configureSteps__();

      return {
        module,
        initStep: initSteps.length > 0 ? initSteps[0] : undefined,
        configureStep: configureSteps.length > 0 ? configureSteps[0] : undefined
      };
    };

    const adPipelineContext = (requestAdsCalls: number = 1): AdPipelineContext => {
      const mockAuctionContext = newGlobalAuctionContext(jsDomWindow);
      sandbox
        .stub(mockAuctionContext, 'hasMinimumRequestAds')
        .callsFake((minAdRequests: number) => {
          const completedRequests = requestAdsCalls - 1;
          return completedRequests + 1 >= minAdRequests;
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
        labelConfigService__: null as any,
        tcData__: fullConsent({ 56: true }),
        adUnitPathVariables__: {},
        auction__: mockAuctionContext,
        assetLoaderService__: assetLoaderService
      };
    };

    beforeEach(() => {
      // Clear any existing UTIQ and Emetriq globals
      delete (jsDomWindow as any).Utiq;
      delete (jsDomWindow as any)._enqAdpParam;
    });

    it('should set up Emetriq event listener when userIdConfig.emetriq.sid is provided', async () => {
      const { initStep } = createUtiqModuleWithEmetriq(true, '29540');

      await initStep!(adPipelineContext());

      // Verify UTIQ queue was set up
      expect((jsDomWindow as any).Utiq).to.be.ok;
      expect((jsDomWindow as any).Utiq.queue).to.be.an('array');
      expect((jsDomWindow as any).Utiq.queue).to.have.length(1);
    });

    it('should not set up Emetriq event listener when userIdConfig.emetriq.sid is not provided', async () => {
      const { initStep } = createUtiqModule(); // No emetriq config

      await initStep!(adPipelineContext());

      // UTIQ should still be set up, but no additional queue items for Emetriq
      expect((jsDomWindow as any).Utiq).to.be.ok;
      expect((jsDomWindow as any).Utiq.queue).to.be.an('array');
      expect((jsDomWindow as any).Utiq.queue).to.have.length(0);
    });

    it('should set _enqAdpParam when UTIQ provides mobile MTID', async () => {
      const { initStep } = createUtiqModuleWithEmetriq(true, '29540');

      await initStep!(adPipelineContext());

      // Simulate UTIQ script loading and API becoming available
      const utiqWindow = jsDomWindow as any;
      utiqWindow.Utiq.API = {
        addEventListener: sandbox.spy()
      };

      // Execute the queued function (this sets up the event listener)
      const queuedFunction = utiqWindow.Utiq.queue[0];
      queuedFunction();

      // Verify the event listener was registered
      expect(utiqWindow.Utiq.API.addEventListener).to.have.been.calledOnce;
      expect(utiqWindow.Utiq.API.addEventListener).to.have.been.calledWith(
        'onIdsAvailable',
        Sinon.match.func
      );

      // Get the event listener function
      const eventListener = utiqWindow.Utiq.API.addEventListener.firstCall.args[1];

      // Simulate the onIdsAvailable event with mobile MTID
      const mockEvent = {
        mtid: 'test-mtid-123',
        atid: 'test-atid-456',
        attrid: 'test-attrid-789',
        category: 'mobile' as const,
        ttl: '3600',
        domain: 'example.com'
      };

      eventListener(mockEvent);

      // Verify _enqAdpParam was set correctly
      expect(utiqWindow._enqAdpParam).to.be.ok;
      expect(utiqWindow._enqAdpParam.id_utiq_29540).to.equal('test-mtid-123');
    });

    it('should not set _enqAdpParam when category is not mobile', async () => {
      const { initStep } = createUtiqModuleWithEmetriq(true, '29540');

      await initStep!(adPipelineContext());

      // Simulate UTIQ script loading and API becoming available
      const utiqWindow = jsDomWindow as any;
      utiqWindow.Utiq.API = {
        addEventListener: sandbox.spy()
      };

      // Execute the queued function
      const queuedFunction = utiqWindow.Utiq.queue[0];
      queuedFunction();

      // Get the event listener function
      const eventListener = utiqWindow.Utiq.API.addEventListener.firstCall.args[1];

      // Simulate the onIdsAvailable event with fixed category
      const mockEvent = {
        mtid: 'test-mtid-123',
        atid: 'test-atid-456',
        attrid: 'test-attrid-789',
        category: 'fixed' as const,
        ttl: '3600',
        domain: 'example.com'
      };

      eventListener(mockEvent);

      // Verify _enqAdpParam was not set
      expect(utiqWindow._enqAdpParam).to.be.undefined;
    });

    it('should not set _enqAdpParam when mtid is missing', async () => {
      const { initStep } = createUtiqModuleWithEmetriq(true, '29540');

      await initStep!(adPipelineContext());

      // Simulate UTIQ script loading and API becoming available
      const utiqWindow = jsDomWindow as any;
      utiqWindow.Utiq.API = {
        addEventListener: sandbox.spy()
      };

      // Execute the queued function
      const queuedFunction = utiqWindow.Utiq.queue[0];
      queuedFunction();

      // Get the event listener function
      const eventListener = utiqWindow.Utiq.API.addEventListener.firstCall.args[1];

      // Simulate the onIdsAvailable event without mtid
      const mockEvent = {
        mtid: '',
        atid: 'test-atid-456',
        attrid: 'test-attrid-789',
        category: 'mobile' as const,
        ttl: '3600',
        domain: 'example.com'
      };

      eventListener(mockEvent);

      // Verify _enqAdpParam was not set
      expect(utiqWindow._enqAdpParam).to.be.undefined;
    });

    it('should use custom SID in _enqAdpParam parameter name', async () => {
      const customSid = 'custom-123';
      const { initStep } = createUtiqModuleWithEmetriq(true, customSid);

      await initStep!(adPipelineContext());

      // Simulate UTIQ script loading and API becoming available
      const utiqWindow = jsDomWindow as any;
      utiqWindow.Utiq.API = {
        addEventListener: sandbox.spy()
      };

      // Execute the queued function
      const queuedFunction = utiqWindow.Utiq.queue[0];
      queuedFunction();

      // Get the event listener function
      const eventListener = utiqWindow.Utiq.API.addEventListener.firstCall.args[1];

      // Simulate the onIdsAvailable event with mobile MTID
      const mockEvent = {
        mtid: 'test-mtid-123',
        atid: 'test-atid-456',
        attrid: 'test-attrid-789',
        category: 'mobile' as const,
        ttl: '3600',
        domain: 'example.com'
      };

      eventListener(mockEvent);

      // Verify _enqAdpParam was set with custom SID
      expect(utiqWindow._enqAdpParam).to.be.ok;
      expect(utiqWindow._enqAdpParam[`id_utiq_${customSid}`]).to.equal('test-mtid-123');
      expect(utiqWindow._enqAdpParam.id_utiq_29540).to.be.undefined; // Should not use default
    });

    it('should preserve existing _enqAdpParam when setting UTIQ parameter', async () => {
      const { initStep } = createUtiqModuleWithEmetriq(true, '29540');

      // Set up existing _enqAdpParam
      const utiqWindow = jsDomWindow as any;
      utiqWindow._enqAdpParam = {
        existing_param: 'existing_value'
      };

      await initStep!(adPipelineContext());

      // Simulate UTIQ script loading and API becoming available
      utiqWindow.Utiq.API = {
        addEventListener: sandbox.spy()
      };

      // Execute the queued function
      const queuedFunction = utiqWindow.Utiq.queue[0];
      queuedFunction();

      // Get the event listener function
      const eventListener = utiqWindow.Utiq.API.addEventListener.firstCall.args[1];

      // Simulate the onIdsAvailable event with mobile MTID
      const mockEvent = {
        mtid: 'test-mtid-123',
        atid: 'test-atid-456',
        attrid: 'test-attrid-789',
        category: 'mobile' as const,
        ttl: '3600',
        domain: 'example.com'
      };

      eventListener(mockEvent);

      // Verify both existing and new parameters are present
      expect(utiqWindow._enqAdpParam).to.be.ok;
      expect(utiqWindow._enqAdpParam.existing_param).to.equal('existing_value');
      expect(utiqWindow._enqAdpParam.id_utiq_29540).to.equal('test-mtid-123');
    });
  });
});
