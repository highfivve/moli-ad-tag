import {
  AdPipeline,
  AdPipelineContext,
  AssetLoadMethod,
  createAssetLoaderService,
  googletag,
  IAdPipelineConfiguration,
  mkInitStep,
  Moli,
  prebidjs,
  tcfapi
} from '@highfivve/ad-tag';

import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import { createGoogletagStub } from '@highfivve/ad-tag/lib/stubs/googletagStubs';
import { noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { dummySchainConfig } from '@highfivve/ad-tag/lib/stubs/schainStubs';
import { reportingServiceStub } from '@highfivve/ad-tag/lib/stubs/reportingServiceStub';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { MappingDefinition } from './adex-mapping';
import { AdexAppConfig, AdexModule, ITheAdexWindow } from './index';
import TCData = tcfapi.responses.TCData;
import { fullConsent, tcDataNoGdpr } from '@highfivve/ad-tag/lib/stubs/consentStubs';
import { GlobalAuctionContext } from '@highfivve/ad-tag/lib/ads/globalAuctionContext';
import { EventService } from '@highfivve/ad-tag/lib/ads/eventService';

use(sinonChai);
use(chaiAsPromised);

describe('The Adex DMP Module', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window &
    googletag.IGoogleTagWindow &
    prebidjs.IPrebidjsWindow &
    ITheAdexWindow &
    Pick<typeof globalThis, 'Date'> = dom.window as any;

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const reportingService = reportingServiceStub();
  const emptyPipelineConfig: IAdPipelineConfiguration = {
    init: [],
    configure: [],
    defineSlots: () => Promise.resolve([]),
    prepareRequestAds: [],
    requestBids: [],
    requestAds: () => Promise.resolve()
  };
  const adPipelineContext = (config: Moli.MoliConfig, tcData?: TCData): AdPipelineContext => {
    return {
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: noopLogger,
      config: config,
      window: jsDomWindow,
      // no service dependencies required
      labelConfigService: null as any,
      reportingService: null as any,
      tcData: tcData ?? fullConsent({ '44': true }),
      adUnitPathVariables: {},
      auction: new GlobalAuctionContext(jsDomWindow, noopLogger, new EventService())
    };
  };

  beforeEach(() => {
    jsDomWindow.googletag = createGoogletagStub();
    // dummy fetch function in order to be able to stub it
    jsDomWindow.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      Promise.resolve(new Response());
  });

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    sandbox.reset();
    sandbox.restore();
  });

  const createAdexModule = (
    spaMode: boolean,
    adexCustomerId: string,
    adexTagId: string,
    mappingDefinitions: Array<MappingDefinition>,
    appConfig?: AdexAppConfig,
    window: ITheAdexWindow = jsDomWindow
  ): AdexModule => {
    return new AdexModule(
      {
        spaMode,
        adexCustomerId,
        adexTagId,
        mappingDefinitions,
        appConfig
      },
      window
    );
  };

  const initModule = (config: {
    module: AdexModule;
    configPipeline?: Moli.pipeline.PipelineConfig;
    moliSlot?: Moli.AdSlot;
  }) => {
    const { moliSlot, configPipeline, module } = config;
    const slot = moliSlot || ({ domId: 'foo' } as Moli.AdSlot);

    const moliConfig: Moli.MoliConfig = {
      slots: [slot],
      pipeline: configPipeline,
      logger: noopLogger,
      schain: dummySchainConfig
    };

    const adPipeline = new AdPipeline(
      emptyPipelineConfig,
      noopLogger,
      jsDomWindow,
      reportingService,
      new GlobalAuctionContext(jsDomWindow, noopLogger, new EventService())
    );

    module.init(moliConfig, assetLoaderService, () => adPipeline);

    return { moliConfig, adPipeline };
  };

  it('should add an init step in non-spa mode', () => {
    const module = createAdexModule(false, '123', '456', []);

    const configPipeline = {
      initSteps: [mkInitStep('stub', _ => Promise.resolve())],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    const { moliConfig } = initModule({ module, configPipeline });

    expect(moliConfig.pipeline).to.be.ok;

    // initialization adds one configureStep and one prepareRequestAdsStep
    expect(moliConfig.pipeline?.initSteps).to.have.lengthOf(2);
    expect(moliConfig.pipeline?.configureSteps).to.have.lengthOf(0);
    expect(moliConfig.pipeline?.prepareRequestAdsSteps).to.have.lengthOf(0);
  });

  it('should add a configure step in spa mode', () => {
    const module = createAdexModule(true, '123', '456', []);

    const configPipeline = {
      initSteps: [mkInitStep('stub', _ => Promise.resolve())],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    const { moliConfig } = initModule({ module, configPipeline });

    expect(moliConfig.pipeline).to.be.ok;

    // initialization adds one configureStep and one prepareRequestAdsStep
    expect(moliConfig.pipeline?.initSteps).to.have.lengthOf(1);
    expect(moliConfig.pipeline?.configureSteps).to.have.lengthOf(1);
    expect(moliConfig.pipeline?.prepareRequestAdsSteps).to.have.lengthOf(0);
  });

  it("shouldn't load the script if no consent is given", async () => {
    const module = createAdexModule(true, '123', '456', []);

    const configPipeline = {
      initSteps: [mkInitStep('stub', _ => Promise.resolve())],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

    const { moliConfig } = initModule({ module, configPipeline });

    await expect(
      moliConfig.pipeline?.configureSteps[0](
        adPipelineContext(
          { ...moliConfig, targeting: { keyValues: { channel: 'Medical' } } },
          fullConsent({ '44': false })
        ),
        []
      )
    ).to.eventually.be.fulfilled;

    expect(loadScriptStub).to.have.not.been.called;
  });

  it("shouldn't load the script if no targeting is given", async () => {
    const module = createAdexModule(true, '123', '456', []);

    const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

    const { moliConfig } = initModule({ module });

    await expect(
      moliConfig.pipeline?.configureSteps[0](
        adPipelineContext({ ...moliConfig, targeting: undefined }),
        []
      )
    ).to.eventually.be.fulfilled;

    expect(loadScriptStub).to.have.not.been.called;
    expect(jsDomWindow._adexc).to.be.undefined;
  });

  it('shouldn load the script if no adex data can be produced with the given mappings', async () => {
    const module = createAdexModule(true, '123', '456', [
      { key: 'subChannel', attribute: 'iab_cat', adexValueType: 'string' }
    ]);

    const configPipeline = {
      initSteps: [mkInitStep('stub', _ => Promise.resolve())],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    const loadScriptStub = sandbox
      .stub(assetLoaderService, 'loadScript')
      .returns(Promise.resolve());

    const { moliConfig } = initModule({ module, configPipeline });

    await expect(
      moliConfig.pipeline?.configureSteps[0](
        adPipelineContext({ ...moliConfig, targeting: { keyValues: { channel: 'Medical' } } }),
        []
      )
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
      const module = createAdexModule(true, '123', '456', [
        { adexValueType: 'string', key: 'channel', attribute: 'iab_cat' }
      ]);

      const configPipeline = {
        initSteps: [mkInitStep('stub', _ => Promise.resolve())],
        configureSteps: [],
        prepareRequestAdsSteps: []
      };

      const loadScriptStub = sandbox
        .stub(assetLoaderService, 'loadScript')
        .returns(Promise.resolve());

      const { moliConfig } = initModule({ module, configPipeline });

      await expect(
        moliConfig.pipeline?.configureSteps[0](
          adPipelineContext(
            { ...moliConfig, targeting: { keyValues: { channel: 'Medical' } } },
            situation.tcData
          ),
          []
        )
      ).to.eventually.be.fulfilled;

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
        ]
      ]);
    })
  );

  it('should load the script only once despite multiple trackings in SPA mode', async () => {
    const module = createAdexModule(true, '123', '456', [
      { adexValueType: 'string', key: 'channel', attribute: 'iab_cat' }
    ]);

    const loadScriptStub = sandbox
      .stub(assetLoaderService, 'loadScript')
      .returns(Promise.resolve());

    const { moliConfig } = initModule({ module });

    await expect(
      moliConfig.pipeline?.configureSteps[0](
        adPipelineContext({ ...moliConfig, targeting: { keyValues: { channel: 'Medical' } } }),
        []
      )
    ).to.eventually.be.fulfilled;

    await expect(
      moliConfig.pipeline?.configureSteps[0](
        adPipelineContext({ ...moliConfig, targeting: { keyValues: { channel: 'Automotive' } } }),
        []
      )
    ).to.eventually.be.fulfilled;

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
    const module = createAdexModule(
      true,
      '123',
      '456',
      [{ adexValueType: 'string', key: 'channel', attribute: 'iab_cat' }],
      { clientTypeKey: 'gf_clientType', advertiserIdKey: 'advertising_id' }
    );

    const { moliConfig } = initModule({ module });

    const context: AdPipelineContext = adPipelineContext(
      {
        ...moliConfig,
        targeting: { keyValues: { gf_clientType: 'android', advertising_id: '1234-5678-9123' } }
      },
      fullConsent({ '44': true })
    );

    const fetchStub = sandbox.stub(context.window, 'fetch').rejects(new Error('whatever'));

    await module.track(context, assetLoaderService);

    expect(fetchStub).to.have.been.calledOnce;
  });
});
