import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { AdPipelineContext } from '../../adPipeline';
import chaiAsPromised from 'chai-as-promised';
import { AdexCommand, AdexModule, ITheAdexWindow } from './index';
import { AssetLoadMethod, createAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { createDom } from 'ad-tag/stubs/browserEnvSetup';
import { googletag } from 'ad-tag/types/googletag';
import { prebidjs } from 'ad-tag/types/prebidjs';
import {
  emptyConfig,
  emptyRuntimeConfig,
  newGlobalAuctionContext,
  noopLogger
} from 'ad-tag/stubs/moliStubs';
import { fullConsent, tcDataNoGdpr } from 'ad-tag/stubs/consentStubs';
import { createGoogletagStub } from 'ad-tag/stubs/googletagStubs';
import { googleAdManager, modules } from 'ad-tag/types/moliConfig';
import { tcfapi } from 'ad-tag/types/tcfapi';
import MappingDefinition = modules.adex.MappingDefinition;
import AdexAppConfig = modules.adex.AdexAppConfig;
import TCData = tcfapi.responses.TCData;
import AdexPartner = modules.adex.AdexPartner;

use(sinonChai);
use(chaiAsPromised);

describe('The Adex DMP Module', () => {
  const sandbox = Sinon.createSandbox();
  let dom, assetLoaderService;

  let jsDomWindow: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow & ITheAdexWindow;

  const setupDomAndServices = () => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    jsDomWindow.googletag = createGoogletagStub();
    jsDomWindow.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      Promise.resolve(new Response());
    assetLoaderService = createAssetLoaderService(jsDomWindow);
  };

  const modulesConfig = (
    isSpa: boolean,
    mappingDefinitions?: MappingDefinition[],
    appConfig?: AdexAppConfig,
    enabledPartners?: AdexPartner[]
  ) => ({
    adex: {
      enabled: true,
      spaMode: isSpa,
      adexCustomerId: '123',
      adexTagId: '456',
      mappingDefinitions: mappingDefinitions ?? [],
      appConfig: appConfig ?? undefined,
      enabledPartners
    }
  });

  const adPipelineContext = (
    tcData?: TCData,
    targeting?: googleAdManager.Targeting
  ): AdPipelineContext => ({
    auctionId__: 'xxxx-xxxx-xxxx-xxxx',
    requestId__: 0,
    requestAdsCalls__: 1,
    env__: 'production',
    logger__: noopLogger,
    config__: { ...emptyConfig, targeting: targeting },
    runtimeConfig__: emptyRuntimeConfig,
    window__: jsDomWindow as any,
    labelConfigService__: null as any,
    tcData__: tcData ?? fullConsent({ '44': true }),
    adUnitPathVariables__: {},
    auction__: newGlobalAuctionContext(jsDomWindow),
    assetLoaderService__: assetLoaderService
  });

  beforeEach(() => {
    setupDomAndServices();
  });

  afterEach(() => {
    sandbox.reset();
    sandbox.restore();
  });

  const createAndConfigureModule = (
    isSpa: boolean,
    mappingDefinitions?: MappingDefinition[],
    appConfig?: AdexAppConfig,
    enabledPartners?: AdexPartner[]
  ) => {
    const module = new AdexModule();
    module.configure__(modulesConfig(isSpa, mappingDefinitions, appConfig, enabledPartners));
    return {
      module,
      initStep: module.initSteps__()[0],
      configureStep: module.configureSteps__()[0]
    };
  };

  const testAdexLoad = async (
    module: AdexModule,
    context: AdPipelineContext,
    shouldLoad: boolean
  ) => {
    const loadScriptStub = sandbox
      .stub(assetLoaderService, 'loadScript')
      .returns(Promise.resolve());
    const init = module.initSteps__()[0];
    expect(init).to.be.ok;

    await init(context);

    if (shouldLoad) {
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: 'the-adex-dmp',
        assetUrl: 'https://dmp.theadex.com/d/123/456/s/adex.js',
        loadMethod: AssetLoadMethod.TAG
      });
    } else {
      expect(loadScriptStub).to.have.not.been.called;
    }
  };

  describe('utiq integration', () => {
    it('should not call trackUtiqId if not configured', async () => {
      const { initStep } = createAndConfigureModule(false);
      const adexCommands: AdexCommand[] = [];
      jsDomWindow._adexc = adexCommands;

      await initStep(adPipelineContext());

      expect(adexCommands).to.have.length(0);
    });

    it('should not call trackUtiqId if partner is not enabled', async () => {
      const { initStep } = createAndConfigureModule(false, [], undefined, []);
      const adexCommands: AdexCommand[] = [];
      jsDomWindow._adexc = adexCommands;

      await initStep(adPipelineContext());

      expect(adexCommands).to.have.length(0);
    });

    it('should call trackUtiqId if partner is enabled', async () => {
      const { initStep } = createAndConfigureModule(false, [], undefined, ['utiq']);
      const adexCommands: AdexCommand[] = [];
      const utiqQueue: any[] = [];
      const addEventListenerSpy = sandbox.spy();
      jsDomWindow._adexc = adexCommands;
      (jsDomWindow as any).Utiq = {
        queue: utiqQueue,
        API: { addEventListener: addEventListenerSpy }
      };

      await initStep(adPipelineContext());

      // process the utiq command queue
      expect(utiqQueue).to.have.length(1);
      const queueCallback = utiqQueue[0];
      queueCallback();

      // process the addEventListener callback
      expect(addEventListenerSpy).to.have.been.calledOnce;
      expect(addEventListenerSpy).to.have.been.calledWith('onIdsAvailable', Sinon.match.func);
      const addEventListenerCallback = addEventListenerSpy.args[0][1];
      addEventListenerCallback({ mtid: '1234-5678-9123' });

      // onIdsAvailable callback should have been called and adexCommands should have been updated
      expect(adexCommands).to.have.length(1);
      expect(adexCommands[0][0]).to.be.eq('/123/456/');
      expect(adexCommands[0][1]).to.be.eq('cm');
      expect(adexCommands[0][2]).to.be.eq('_cm');
      expect(adexCommands[0][3]).to.deep.equal([308, '1234-5678-9123']);
    });

    it('should call trackUtiqId if partner is enabled in SPAs', async () => {
      const { configureStep } = createAndConfigureModule(true, [], undefined, ['utiq']);
      const adexCommands: AdexCommand[] = [];
      const utiqQueue: any[] = [];
      const addEventListenerSpy = sandbox.spy();
      jsDomWindow._adexc = adexCommands;
      (jsDomWindow as any).Utiq = {
        queue: utiqQueue,
        API: { addEventListener: addEventListenerSpy }
      };

      await configureStep(adPipelineContext(), []);

      // process the utiq command queue
      expect(utiqQueue).to.have.length(1);
      const queueCallback = utiqQueue[0];
      queueCallback();

      // process the addEventListener callback
      expect(addEventListenerSpy).to.have.been.calledOnce;
      expect(addEventListenerSpy).to.have.been.calledWith('onIdsAvailable', Sinon.match.func);
      const addEventListenerCallback = addEventListenerSpy.args[0][1];
      addEventListenerCallback({ mtid: '1234-5678-9123' });

      // onIdsAvailable callback should have been called and adexCommands should have been updated
      expect(adexCommands).to.have.length(1);
      expect(adexCommands[0][0]).to.be.eq('/123/456/');
      expect(adexCommands[0][1]).to.be.eq('cm');
      expect(adexCommands[0][2]).to.be.eq('_cm');
      expect(adexCommands[0][3]).to.deep.equal([308, '1234-5678-9123']);
    });
  });

  describe('init step', () => {
    it('should add an init step', () => {
      const { module } = createAndConfigureModule(false);
      const initSteps = module.initSteps__();

      expect(initSteps).to.have.length(1);
      expect(initSteps[0].name).to.be.eq('DMP module setup');
    });

    it('should not add a configure step in non-spa mode', () => {
      const { module } = createAndConfigureModule(false);
      const configureSteps = module.configureSteps__();

      expect(configureSteps).to.have.length(0);
    });

    it('should add a configure step in spa mode', () => {
      const { module } = createAndConfigureModule(true);
      const configureSteps = module.configureSteps__();

      expect(configureSteps).to.have.length(1);
    });
  });

  it("shouldn't load the script if no consent is given", async () => {
    const { module } = createAndConfigureModule(true);
    await testAdexLoad(
      module,
      adPipelineContext(fullConsent({ '44': false }), { keyValues: { channel: 'Medical' } }),
      false
    );
  });

  it("shouldn't load the script if no targeting is given", async () => {
    const { module } = createAndConfigureModule(true);
    await testAdexLoad(module, adPipelineContext(fullConsent({ '44': true }), undefined), false);
  });

  it("shouldn't load the script if no adex data can be produced with the given mappings", async () => {
    const { module } = createAndConfigureModule(true, [
      { key: 'subChannel', attribute: 'iab_cat', adexValueType: 'string' }
    ]);

    const loadScriptStub = sandbox
      .stub(assetLoaderService, 'loadScript')
      .returns(Promise.resolve());

    const init = module.initSteps__()[0];
    expect(init).to.be.ok;

    await expect(
      init(adPipelineContext(fullConsent({ '44': true }), { keyValues: { channel: 'Medical' } }))
    ).to.eventually.be.fulfilled;

    expect(loadScriptStub).to.have.been.called;
    expect(jsDomWindow._adexc).to.be.ok;
  });

  const consentSituations: Array<{ description: string; tcData: TCData }> = [
    { description: 'no GDPR applies', tcData: tcDataNoGdpr },
    {
      description: 'GDPR applies and consent is given',
      tcData: fullConsent({ '44': true })
    }
  ];

  consentSituations.forEach(situation =>
    it(`should load the script if ${situation.description}`, async () => {
      const { module } = createAndConfigureModule(true, [
        { key: 'channel', attribute: 'iab_cat', adexValueType: 'string' }
      ]);

      await testAdexLoad(
        module,
        adPipelineContext(situation.tcData, { keyValues: { channel: 'Medical' } }),
        true
      );

      expect(jsDomWindow._adexc).to.deep.equal([
        [
          `/123/456/`,
          'ut', // usertrack
          '_kv', // key values
          [{ iab_cat: 'Medical' }, 1]
        ]
      ]);
    })
  );

  describe('targetings', () => {
    beforeEach(() => {
      sandbox.stub(assetLoaderService, 'loadScript').returns(Promise.resolve());
    });

    it('should use targeting from config and runtimeConfig', async () => {
      const { module } = createAndConfigureModule(true, [
        { key: 'channel', attribute: 'iab_cat', adexValueType: 'string' },
        { key: 'iab_v3', attribute: 'example_iab_v3', adexValueType: 'string' }
      ]);

      const adPipelineCtx: AdPipelineContext = {
        ...adPipelineContext(fullConsent({ '44': true }), {
          keyValues: { channel: 'Medical' }
        }),
        runtimeConfig__: {
          ...emptyRuntimeConfig,
          keyValues: {
            iab_v3: 'example_iab_v3_value'
          }
        }
      };
      const init = module.initSteps__()[0];
      expect(init).to.be.ok;
      await init(adPipelineCtx);

      expect(jsDomWindow._adexc).to.deep.equal([
        [
          `/123/456/`,
          'ut', // usertrack
          '_kv', // key values
          [{ iab_cat: 'Medical', example_iab_v3: 'example_iab_v3_value' }, 1]
        ]
      ]);
    });

    it('should override server side targeting with client side targeting', async () => {
      const { module } = createAndConfigureModule(true, [
        { key: 'channel', attribute: 'iab_cat', adexValueType: 'string' },
        { key: 'iab_v3', attribute: 'example_iab_v3', adexValueType: 'string' }
      ]);

      const adPipelineCtx: AdPipelineContext = {
        ...adPipelineContext(fullConsent({ '44': true }), {
          keyValues: { channel: 'Medical', iab_v3: 'example_iab_v3_value' }
        }),
        runtimeConfig__: {
          ...emptyRuntimeConfig,
          keyValues: {
            iab_v3: 'example_iab_v3_value_overridden'
          }
        }
      };
      const init = module.initSteps__()[0];
      expect(init).to.be.ok;
      await init(adPipelineCtx);

      expect(jsDomWindow._adexc).to.deep.equal([
        [
          `/123/456/`,
          'ut', // usertrack
          '_kv', // key values
          [{ iab_cat: 'Medical', example_iab_v3: 'example_iab_v3_value_overridden' }, 1]
        ]
      ]);
    });

    it('should set runtime config targeting if no server side targeting is given', async () => {
      const { module } = createAndConfigureModule(true, [
        { key: 'channel', attribute: 'iab_cat', adexValueType: 'string' },
        { key: 'iab_v3', attribute: 'example_iab_v3', adexValueType: 'string' }
      ]);

      const adPipelineCtx: AdPipelineContext = {
        ...adPipelineContext(fullConsent({ '44': true }), undefined),
        runtimeConfig__: {
          ...emptyRuntimeConfig,
          keyValues: {
            iab_v3: 'example_iab_v3_value'
          }
        }
      };
      const init = module.initSteps__()[0];
      expect(init).to.be.ok;
      await init(adPipelineCtx);

      expect(jsDomWindow._adexc).to.deep.equal([
        [
          `/123/456/`,
          'ut', // usertrack
          '_kv', // key values
          [{ example_iab_v3: 'example_iab_v3_value' }, 1]
        ]
      ]);
    });
  });

  it('should load the script only once despite multiple trackings in SPA mode', async () => {
    const { module } = createAndConfigureModule(true, [
      { key: 'channel', attribute: 'iab_cat', adexValueType: 'string' }
    ]);

    const loadScriptStub = sandbox
      .stub(assetLoaderService, 'loadScript')
      .returns(Promise.resolve());

    const init = module.initSteps__()[0];
    expect(init).to.be.ok;

    const adPipelineCtxMed = adPipelineContext(fullConsent({ '44': true }), {
      keyValues: { channel: 'Medical' }
    });

    await expect(init(adPipelineCtxMed)).to.eventually.be.fulfilled;

    const adPipelineCtxAuto = adPipelineContext(fullConsent({ '44': true }), {
      keyValues: { channel: 'Automotive' }
    });

    await expect(init(adPipelineCtxAuto)).to.eventually.be.fulfilled;

    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: 'the-adex-dmp',
      assetUrl: 'https://dmp.theadex.com/d/123/456/s/adex.js',
      loadMethod: AssetLoadMethod.TAG
    });

    expect(jsDomWindow._adexc).to.deep.equal([
      [
        `/123/456/`,
        'ut', // usertrack
        '_kv', // key values
        [{ iab_cat: 'Medical' }, 1]
      ],
      [
        `/123/456/`,
        'ut', // usertrack
        '_kv', // key values
        [{ iab_cat: 'Automotive' }, 1]
      ]
    ]);
  });

  it('should use the in-app endpoint instead of loading the script if there is an appConfig and clientType is either android or ios', async () => {
    const moduleConfig = modulesConfig(
      true,
      [{ key: 'channel', attribute: 'iab_cat', adexValueType: 'string' }],
      {
        clientTypeKey: 'gf_clientType',
        advertiserIdKey: 'advertising_id'
      }
    );
    const { module } = createAndConfigureModule(
      moduleConfig.adex.spaMode,
      moduleConfig.adex.mappingDefinitions,
      moduleConfig.adex.appConfig
    );

    const adPipelineCtx = adPipelineContext(fullConsent({ '44': true }), {
      keyValues: { gf_clientType: 'android', advertising_id: '1234-5678-9123' }
    });

    const fetchStub = sandbox.stub(adPipelineCtx.window__, 'fetch').rejects(new Error('whatever'));

    await module.track(adPipelineCtx, moduleConfig.adex);

    expect(fetchStub).to.have.been.calledOnce;
  });
});
