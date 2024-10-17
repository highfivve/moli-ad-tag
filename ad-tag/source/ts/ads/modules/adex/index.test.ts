import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { AdPipelineContext } from '../../adPipeline';
import { GlobalAuctionContext } from '../../globalAuctionContext';
import chaiAsPromised from 'chai-as-promised';
import { AdexModule, ITheAdexWindow } from './index';
import { AssetLoadMethod, createAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { createDom } from 'ad-tag/stubs/browserEnvSetup';
import { googletag } from 'ad-tag/types/googletag';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { emptyConfig, emptyRuntimeConfig, noopLogger } from 'ad-tag/stubs/moliStubs';
import { fullConsent, tcDataNoGdpr } from 'ad-tag/stubs/consentStubs';
import { createGoogletagStub } from 'ad-tag/stubs/googletagStubs';
import { googleAdManager, modules } from 'ad-tag/types/moliConfig';
import MappingDefinition = modules.adex.MappingDefinition;
import AdexAppConfig = modules.adex.AdexAppConfig;
import { tcfapi } from 'ad-tag/types/tcfapi';
import TCData = tcfapi.responses.TCData;

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
    jsDomWindow._adexc = [];
    assetLoaderService = createAssetLoaderService(jsDomWindow);
  };

  const modulesConfig = (
    isSpa: boolean,
    mappingDefinitions?: MappingDefinition[],
    appConfig?: AdexAppConfig
  ) => ({
    adex: {
      enabled: true,
      spaMode: isSpa,
      adexCustomerId: '123',
      adexTagId: '456',
      mappingDefinitions: mappingDefinitions ?? [],
      appConfig: appConfig ?? undefined
    }
  });

  const adPipelineContext = (
    tcData?: TCData,
    targeting?: googleAdManager.Targeting
  ): AdPipelineContext => ({
    auctionId: 'xxxx-xxxx-xxxx-xxxx',
    requestId: 0,
    requestAdsCalls: 1,
    env: 'production',
    logger: noopLogger,
    config: { ...emptyConfig, targeting: targeting },
    runtimeConfig: emptyRuntimeConfig,
    window: jsDomWindow as any,
    labelConfigService: null as any,
    tcData: tcData ?? fullConsent({ '44': true }),
    adUnitPathVariables: {},
    auction: new GlobalAuctionContext(jsDomWindow as any),
    assetLoaderService: assetLoaderService
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
    appConfig?: AdexAppConfig
  ) => {
    const module = new AdexModule();
    module.configure(modulesConfig(isSpa, mappingDefinitions, appConfig));
    return module;
  };

  const testAdexLoad = async (
    module: AdexModule,
    context: AdPipelineContext,
    shouldLoad: boolean
  ) => {
    const loadScriptStub = sandbox
      .stub(assetLoaderService, 'loadScript')
      .returns(Promise.resolve());
    const init = module.initSteps()[0];
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

  describe('init step', () => {
    it('should add an init step', () => {
      const module = createAndConfigureModule(false);
      const initSteps = module.initSteps();

      expect(initSteps).to.have.length(1);
      expect(initSteps[0].name).to.be.eq('DMP module setup');
    });

    it('should not add a configure step in non-spa mode', () => {
      const module = createAndConfigureModule(false);
      const configureSteps = module.configureSteps();

      expect(configureSteps).to.have.length(0);
    });

    it('should add a configure step in spa mode', () => {
      const module = createAndConfigureModule(true);
      const configureSteps = module.configureSteps();

      expect(configureSteps).to.have.length(1);
    });
  });

  it("shouldn't load the script if no consent is given", async () => {
    const module = createAndConfigureModule(true);
    await testAdexLoad(
      module,
      adPipelineContext(fullConsent({ '44': false }), { keyValues: { channel: 'Medical' } }),
      false
    );
  });

  it("shouldn't load the script if no targeting is given", async () => {
    const module = createAndConfigureModule(true);
    await testAdexLoad(module, adPipelineContext(fullConsent({ '44': true }), undefined), false);
  });

  it("shouldn't load the script if no adex data can be produced with the given mappings", async () => {
    const module = createAndConfigureModule(true, [
      { key: 'subChannel', attribute: 'iab_cat', adexValueType: 'string' }
    ]);

    const loadScriptStub = sandbox
      .stub(assetLoaderService, 'loadScript')
      .returns(Promise.resolve());

    const init = module.initSteps()[0];
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
      const module = createAndConfigureModule(true, [
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
      const module = createAndConfigureModule(true, [
        { key: 'channel', attribute: 'iab_cat', adexValueType: 'string' },
        { key: 'iab_v3', attribute: 'example_iab_v3', adexValueType: 'string' }
      ]);

      const adPipelineCtx: AdPipelineContext = {
        ...adPipelineContext(fullConsent({ '44': true }), {
          keyValues: { channel: 'Medical' }
        }),
        runtimeConfig: {
          ...emptyRuntimeConfig,
          keyValues: {
            iab_v3: 'example_iab_v3_value'
          }
        }
      };
      const init = module.initSteps()[0];
      expect(init).to.be.ok;

      await expect(init(adPipelineCtx)).to.eventually.be.fulfilled;

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
      const module = createAndConfigureModule(true, [
        { key: 'channel', attribute: 'iab_cat', adexValueType: 'string' },
        { key: 'iab_v3', attribute: 'example_iab_v3', adexValueType: 'string' }
      ]);

      const adPipelineCtx: AdPipelineContext = {
        ...adPipelineContext(fullConsent({ '44': true }), {
          keyValues: { channel: 'Medical', iab_v3: 'example_iab_v3_value' }
        }),
        runtimeConfig: {
          ...emptyRuntimeConfig,
          keyValues: {
            iab_v3: 'example_iab_v3_value_overridden'
          }
        }
      };
      const init = module.initSteps()[0];
      expect(init).to.be.ok;

      await expect(init(adPipelineCtx)).to.eventually.be.fulfilled;

      expect(jsDomWindow._adexc).to.deep.equal([
        [
          `/123/456/`,
          'ut', // usertrack
          '_kv', // key values
          [{ iab_cat: 'Medical', example_iab_v3: 'example_iab_v3_value_overridden' }, 1]
        ]
      ]);
    });
  });

  it('should load the script only once despite multiple trackings in SPA mode', async () => {
    const module = createAndConfigureModule(true, [
      { key: 'channel', attribute: 'iab_cat', adexValueType: 'string' }
    ]);

    const loadScriptStub = sandbox
      .stub(assetLoaderService, 'loadScript')
      .returns(Promise.resolve());

    const init = module.initSteps()[0];
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
    const module = createAndConfigureModule(
      moduleConfig.adex.spaMode,
      moduleConfig.adex.mappingDefinitions,
      moduleConfig.adex.appConfig
    );

    const adPipelineCtx = adPipelineContext(fullConsent({ '44': true }), {
      keyValues: { gf_clientType: 'android', advertising_id: '1234-5678-9123' }
    });

    const fetchStub = sandbox.stub(adPipelineCtx.window, 'fetch').rejects(new Error('whatever'));

    await module.track(adPipelineCtx, moduleConfig.adex);

    expect(fetchStub).to.have.been.calledOnce;
  });
});
