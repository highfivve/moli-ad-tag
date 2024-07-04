import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import { createAssetLoaderService } from '../../../util/assetLoaderService';
import { GoogleAdManagerKeyValueMap, modules, MoliConfig } from '../../../types/moliConfig';
import { AdPipelineContext } from '../../../ads/adPipeline';
import { googletag } from '../../../types/googletag';
import { Zeotap } from '../../../ads/modules/zeotap/index';
import { AssetLoadMethod } from '../../../util/assetLoaderService';
import { createDom } from '../../../stubs/browserEnvSetup';
import { prebidjs } from '../../../types/prebidjs';
import { emptyRuntimeConfig, noopLogger } from '../../../stubs/moliStubs';
import { fullConsent } from '../../../stubs/consentStubs';
import { GlobalAuctionContext } from '../../../ads/globalAuctionContext';
import { dummySchainConfig } from '../../../stubs/schainStubs';
import { MoliRuntime } from '../../../types/moliRuntime';
import MoliWindow = MoliRuntime.MoliWindow;

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('Zeotap Module', () => {
  const sandbox = Sinon.createSandbox();
  const dom = createDom();
  const jsDomWindow: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow & MoliWindow =
    dom.window as any;

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  const adPipelineContext = (config: MoliConfig): AdPipelineContext => {
    return {
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: noopLogger,
      config: config,
      window: jsDomWindow,
      // no service dependencies required
      labelConfigService: null as any,
      runtimeConfig: emptyRuntimeConfig,
      tcData: fullConsent({ 301: true }),
      adUnitPathVariables: {},
      auction: new GlobalAuctionContext(jsDomWindow),
      assetLoaderService: assetLoaderService
    };
  };

  const createZeotap = (): Zeotap => new Zeotap();

  const moliConfig = (keyValues: GoogleAdManagerKeyValueMap): MoliConfig => {
    return {
      slots: [],
      targeting: {
        keyValues
      },
      schain: dummySchainConfig
    };
  };

  beforeEach(() => {
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should fetch the zeotap script and encode parameters into the URL', async () => {
    const modulesConfig: modules.ModulesConfig = {
      zeotap: {
        enabled: true,
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        hashedEmailAddress: 'somehashedaddress',
        mode: 'default',
        dataKeyValues: [
          { keyValueKey: 'channel', parameterKey: 'zcat' },
          { keyValueKey: 'subChannel', parameterKey: 'zscat' },
          { keyValueKey: 'tags', parameterKey: 'zcid' }
        ],
        exclusionKeyValues: []
      }
    };
    const module = createZeotap();
    module.configure(modulesConfig);

    const init = module.initSteps()[0];

    await init(
      adPipelineContext(
        moliConfig({
          channel: 'VideoGaming',
          subChannel: 'PCGames',
          tags: ['technik', 'computer', 'technologie', 'pc', 'smartphone', 'internet']
        })
      )
    );

    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl:
        '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337&idp=1&zcat=VideoGaming&zscat=PCGames&zcid=technik%2Ccomputer%2Ctechnologie%2Cpc%2Csmartphone%2Cinternet&z_e_sha2_l=somehashedaddress'
    });
  });

  it('should disable idp if no hashed email address is given', async () => {
    const modulesConfig: modules.ModulesConfig = {
      zeotap: {
        enabled: true,
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        hashedEmailAddress: undefined,
        countryCode: 'DEU',
        mode: 'default',
        dataKeyValues: [
          { keyValueKey: 'channel', parameterKey: 'zcat' },
          { keyValueKey: 'tags', parameterKey: 'zcid' }
        ],
        exclusionKeyValues: []
      }
    };
    const module = createZeotap();
    module.configure(modulesConfig);

    const init = module.initSteps()[0];

    await init(
      adPipelineContext(
        moliConfig({
          channel: 'TechnologyAndComputing',
          tags: ['hardware', 'roboter']
        })
      )
    );

    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl:
        '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337&idp=0&zcat=TechnologyAndComputing&zcid=hardware%2Croboter&ctry=DEU'
    });
  });

  it('should allow multiple loading of the script if running in spa mode', async () => {
    const modulesConfig: modules.ModulesConfig = {
      zeotap: {
        enabled: true,
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        hashedEmailAddress: 'somehashedaddress',
        countryCode: 'DEU',
        mode: 'spa',
        dataKeyValues: [
          { keyValueKey: 'channel', parameterKey: 'zcat' },
          { keyValueKey: 'tags', parameterKey: 'zcid' }
        ],
        exclusionKeyValues: []
      }
    };
    const module = createZeotap();
    module.configure(modulesConfig);

    const configureStep = module.configureSteps()[0];

    await configureStep(
      adPipelineContext(
        moliConfig({
          channel: 'VideoGaming',
          tags: ['technik', 'computer', 'technologie', 'pc', 'smartphone', 'internet']
        })
      ),
      []
    );

    // id+ should be active on first call
    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl:
        '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337&idp=1&zcat=VideoGaming&zcid=technik%2Ccomputer%2Ctechnologie%2Cpc%2Csmartphone%2Cinternet&ctry=DEU&z_e_sha2_l=somehashedaddress'
    });

    const configure = module.configureSteps()[0];

    await configure(
      adPipelineContext(
        moliConfig({ channel: 'TechnologyAndComputing', tags: ['hardware', 'roboter'] })
      ),
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
    const modulesConfig: modules.ModulesConfig = {
      zeotap: {
        enabled: true,
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        mode: 'default',
        dataKeyValues: [],
        exclusionKeyValues: []
      }
    };
    const module = createZeotap();
    module.configure(modulesConfig);

    const init = module.initSteps()[0];

    const config = moliConfig({
      channel: 'TechnologyAndComputing',
      tags: ['hardware', 'roboter']
    });

    await init(adPipelineContext(config));
    await init(adPipelineContext(config));

    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337&idp=0'
    });
  });

  it("shouldn't load the script if targeting exclusions match", async () => {
    const modulesConfig: modules.ModulesConfig = {
      zeotap: {
        enabled: true,
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        mode: 'default',
        dataKeyValues: [],
        exclusionKeyValues: [{ keyValueKey: 'subChannel', disableOnValue: 'Pornography' }]
      }
    };
    const module = createZeotap();
    module.configure(modulesConfig);

    const init = module.initSteps()[0];

    await init(
      adPipelineContext(
        moliConfig({
          channel: 'NonStandardContent',
          subChannel: 'Pornography'
        })
      )
    );

    expect(loadScriptStub).to.not.have.been.called;
  });

  it("shouldn't load the script if consent is missing", async () => {
    const modulesConfig: modules.ModulesConfig = {
      zeotap: {
        enabled: true,
        assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
        mode: 'default',
        dataKeyValues: [],
        exclusionKeyValues: [{ keyValueKey: 'subChannel', disableOnValue: 'Pornography' }]
      }
    };
    const module = createZeotap();
    module.configure(modulesConfig);

    const init = module.initSteps()[0];

    const config = moliConfig({
      channel: 'NonStandardContent',
      subChannel: 'Pornography'
    });

    await init(adPipelineContext(config));

    const context: AdPipelineContext = {
      ...adPipelineContext(config),
      tcData: fullConsent()
    };

    await init(context);

    expect(loadScriptStub).to.not.have.been.called;
  });
});
