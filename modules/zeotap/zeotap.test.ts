import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';

import {
  AdPipelineContext,
  AssetLoadMethod,
  createAssetLoaderService,
  googletag,
  Moli,
  prebidjs
} from '@highfivve/ad-tag';

import { Zeotap } from './zeotap';
import { noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { fullConsent } from '@highfivve/ad-tag/lib/stubs/consentStubs';
import { dummySchainConfig } from '@highfivve/ad-tag/lib/stubs/schainStubs';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('Zeotap Module', () => {
  const sandbox = Sinon.createSandbox();
  const dom = createDom();
  const jsDomWindow: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow =
    dom.window as any;

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  const emptyConfigPipeline = (): Moli.pipeline.PipelineConfig => ({
    initSteps: [],
    configureSteps: [],
    prepareRequestAdsSteps: []
  });

  const adPipelineContext = (config: Moli.MoliConfig): AdPipelineContext => {
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
      tcData: fullConsent({ 301: true })
    };
  };

  const initModule = (
    module: Zeotap,
    keyValues: Moli.DfpKeyValueMap,
    configPipeline?: Moli.pipeline.PipelineConfig
  ): Moli.MoliConfig => {
    const moliConfig: Moli.MoliConfig = {
      slots: [],
      pipeline: configPipeline,
      logger: noopLogger,
      targeting: {
        keyValues
      },
      schain: dummySchainConfig
    };

    module.init(moliConfig, assetLoaderService);

    return moliConfig;
  };

  beforeEach(() => {
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should fetch the zeotap script and encode parameters into the URL', async () => {
    const module = new Zeotap(
      {
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        hashedEmailAddress: 'somehashedaddress',
        mode: 'default',
        dataKeyValues: [
          { keyValueKey: 'channel', parameterKey: 'zcat' },
          { keyValueKey: 'subChannel', parameterKey: 'zscat' },
          { keyValueKey: 'tags', parameterKey: 'zcid' }
        ],
        exclusionKeyValues: []
      },
      jsDomWindow
    );

    const moliConfig = initModule(
      module,
      {
        channel: 'VideoGaming',
        subChannel: 'PCGames',
        tags: ['technik', 'computer', 'technologie', 'pc', 'smartphone', 'internet']
      },
      emptyConfigPipeline()
    );

    await moliConfig.pipeline?.initSteps[0](adPipelineContext(moliConfig));

    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl:
        '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337&idp=1&zcat=VideoGaming&zscat=PCGames&zcid=technik%2Ccomputer%2Ctechnologie%2Cpc%2Csmartphone%2Cinternet&z_e_sha2_l=somehashedaddress'
    });
  });

  it('should disable idp if no hashed email address is given', async () => {
    const module = new Zeotap(
      {
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        hashedEmailAddress: undefined,
        countryCode: 'DEU',
        mode: 'default',
        dataKeyValues: [
          { keyValueKey: 'channel', parameterKey: 'zcat' },
          { keyValueKey: 'tags', parameterKey: 'zcid' }
        ],
        exclusionKeyValues: []
      },
      jsDomWindow
    );

    const moliConfig = initModule(
      module,
      {
        channel: 'TechnologyAndComputing',
        tags: ['hardware', 'roboter']
      },
      emptyConfigPipeline()
    );

    await moliConfig.pipeline?.initSteps[0](adPipelineContext(moliConfig));

    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl:
        '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337&idp=0&zcat=TechnologyAndComputing&zcid=hardware%2Croboter&ctry=DEU'
    });
  });

  it('should allow multiple loading of the script if running in spa mode', async () => {
    const module = new Zeotap(
      {
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        hashedEmailAddress: 'somehashedaddress',
        countryCode: 'DEU',
        mode: 'spa',
        dataKeyValues: [
          { keyValueKey: 'channel', parameterKey: 'zcat' },
          { keyValueKey: 'tags', parameterKey: 'zcid' }
        ],
        exclusionKeyValues: []
      },
      jsDomWindow
    );

    const moliConfig = initModule(
      module,
      {
        channel: 'VideoGaming',
        tags: ['technik', 'computer', 'technologie', 'pc', 'smartphone', 'internet']
      },
      emptyConfigPipeline()
    );

    await moliConfig.pipeline?.configureSteps[0](adPipelineContext(moliConfig), []);

    // id+ should be active on first call
    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl:
        '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337&idp=1&zcat=VideoGaming&zcid=technik%2Ccomputer%2Ctechnologie%2Cpc%2Csmartphone%2Cinternet&ctry=DEU&z_e_sha2_l=somehashedaddress'
    });

    await moliConfig.pipeline?.configureSteps[0](
      adPipelineContext({
        ...moliConfig,
        targeting: {
          keyValues: {
            channel: 'TechnologyAndComputing',
            tags: ['hardware', 'roboter']
          }
        }
      }),
      []
    );

    expect(loadScriptStub).to.have.been.calledTwice;
    // id+ should be deactivated on second call
    expect(loadScriptStub.secondCall).to.have.been.calledWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl:
        '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337&idp=0&zcat=TechnologyAndComputing&zcid=hardware%2Croboter&ctry=DEU&z_e_sha2_l=somehashedaddress'
    });
  });

  it('should only allow loading of the script one time if running in default mode', async () => {
    const module = new Zeotap(
      {
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        mode: 'default',
        dataKeyValues: [],
        exclusionKeyValues: []
      },
      jsDomWindow
    );

    const moliConfig = initModule(
      module,
      {
        channel: 'TechnologyAndComputing',
        tags: ['hardware', 'roboter']
      },
      emptyConfigPipeline()
    );

    await moliConfig.pipeline?.initSteps[0](adPipelineContext(moliConfig));
    await moliConfig.pipeline?.initSteps[0](adPipelineContext(moliConfig));

    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337&idp=0'
    });
  });

  it("shouldn't load the script if targeting exclusions match", async () => {
    const module = new Zeotap(
      {
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        mode: 'default',
        dataKeyValues: [],
        exclusionKeyValues: [{ keyValueKey: 'subChannel', disableOnValue: 'Pornography' }]
      },
      jsDomWindow
    );

    const moliConfig = initModule(
      module,
      {
        channel: 'NonStandardContent',
        subChannel: 'Pornography'
      },
      emptyConfigPipeline()
    );

    await moliConfig.pipeline?.initSteps[0](adPipelineContext(moliConfig));

    expect(loadScriptStub).to.not.have.been.called;
  });

  it("shouldn't load the script if consent is missing", async () => {
    const module = new Zeotap(
      {
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        mode: 'default',
        dataKeyValues: [],
        exclusionKeyValues: [{ keyValueKey: 'subChannel', disableOnValue: 'Pornography' }]
      },
      jsDomWindow
    );

    const moliConfig = initModule(
      module,
      {
        channel: 'NonStandardContent',
        subChannel: 'Pornography'
      },
      emptyConfigPipeline()
    );

    const context: AdPipelineContext = {
      ...adPipelineContext(moliConfig),
      tcData: fullConsent()
    };

    await moliConfig.pipeline?.initSteps[0](context);

    expect(loadScriptStub).to.not.have.been.called;
  });
});
