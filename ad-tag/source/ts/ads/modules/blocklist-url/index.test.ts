import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { modules, MoliConfig } from 'ad-tag/types/moliConfig';
import Blocklist = modules.blocklist.Blocklist;
import StaticBlocklistProvider = modules.blocklist.StaticBlocklistProvider;
import DynamicBlocklistProvider = modules.blocklist.DynamicBlocklistProvider;
import { BlocklistedUrls } from 'ad-tag/ads/modules/blocklist-url/index';
import { googletag } from 'ad-tag/types/googletag';
import { createAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import BlocklistUrlsBlockingConfig = modules.blocklist.BlocklistUrlsBlockingConfig;
import { createDom } from 'ad-tag/stubs/browserEnvSetup';
import { createGoogletagStub } from 'ad-tag/stubs/googletagStubs';
import {
  emptyConfig,
  emptyRuntimeConfig,
  newEmptyConfig,
  noopLogger
} from 'ad-tag/stubs/moliStubs';
import { AdPipelineContext, ConfigureStep } from 'ad-tag/ads/adPipeline';
import { fullConsent } from 'ad-tag/stubs/consentStubs';
import { GlobalAuctionContext } from 'ad-tag/ads/globalAuctionContext';
import chaiAsPromised from 'chai-as-promised';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('BlocklistedUrls Module', () => {
  const sandbox = Sinon.createSandbox();
  let dom, assetLoaderService, loadJsonStub, googleTagStub;
  let jsDomWindow: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow;

  const setupDomAndServices = () => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    assetLoaderService = createAssetLoaderService(jsDomWindow);
    loadJsonStub = sandbox.stub(assetLoaderService, 'loadJson');
    googleTagStub = createGoogletagStub();
    dom.window.googletag = googleTagStub;
  };

  const adPipelineContext = (config: MoliConfig): AdPipelineContext => ({
    requestId: 0,
    requestAdsCalls: 1,
    env: 'production',
    logger: noopLogger,
    config: config ?? emptyConfig,
    runtimeConfig: emptyRuntimeConfig,
    window: jsDomWindow as any,
    labelConfigService: null as any,
    tcData: fullConsent(),
    adUnitPathVariables: {},
    auction: new GlobalAuctionContext(jsDomWindow as any)
  });

  const blocklist = (
    patterns: string[],
    matchType: 'regex' | 'contains' | 'exact' = 'regex'
  ): Blocklist => {
    return {
      urls: patterns.map(pattern => {
        return { pattern, matchType };
      })
    };
  };

  const staticBlocklistProvider = (
    patterns: string[] = [],
    matchType: 'regex' | 'contains' | 'exact' = 'regex'
  ): StaticBlocklistProvider => {
    return { provider: 'static', blocklist: blocklist(patterns, matchType) };
  };

  const dynamicBlocklistProvider: DynamicBlocklistProvider = {
    provider: 'dynamic',
    endpoint: 'http://localhost/blocklist.json'
  };

  const modulesConfig = (
    config?: BlocklistUrlsBlockingConfig
  ): { blocklist: BlocklistUrlsBlockingConfig } => ({
    blocklist: config ?? {
      enabled: true,
      mode: 'block',
      blocklist: staticBlocklistProvider()
    }
  });

  beforeEach(() => {
    setupDomAndServices();
  });

  afterEach(() => {
    sandbox.reset();
  });

  const createAndConfigureModule = (config?: BlocklistUrlsBlockingConfig) => {
    const module = new BlocklistedUrls();
    module.configure(modulesConfig(config));
    return module;
  };

  it('should configure nothing in test mode', async () => {
    const module = createAndConfigureModule();
    const init = module.initSteps(assetLoaderService)[0];
    expect(init).to.be.ok;
  });

  describe('block mode with static provider', () => {
    const createInitializedModule = (
      patterns: string[]
    ): { configureStep: ConfigureStep; module: BlocklistedUrls; config: MoliConfig } => {
      const config = newEmptyConfig();

      const blocklistConfig: BlocklistUrlsBlockingConfig = {
        enabled: true,
        mode: 'block',
        blocklist: staticBlocklistProvider(patterns)
      };

      const module = createAndConfigureModule(blocklistConfig);

      const init = module.initSteps(assetLoaderService)[0];
      expect(init).to.be.ok;

      const initSteps = module.initSteps(assetLoaderService);
      expect(initSteps).to.have.length(1);

      return { configureStep: initSteps[0], module, config };
    };

    it('should add a configure step that resolves if no blocklisted urls are defined', () => {
      const { configureStep, config } = createInitializedModule([]);
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });
    it('should add a configure step that resolves if no blocklisted urls are found', () => {
      const { configureStep, config } = createInitializedModule(['foo']);
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });

    describe('configure step that rejects if a url is blocklisted', () => {
      [
        '/blocklisted',
        'blocklisted',
        'localhost',
        'https://localhost',
        '^https://localhost/blocklisted/url$'
      ].forEach(pattern =>
        it(`should match pattern ${pattern}`, () => {
          const { configureStep, config } = createInitializedModule([pattern]);
          dom.reconfigure({
            url: 'https://localhost/blocklisted/url'
          });
          return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
        })
      );
    });
    it('should ignore invalid patterns', () => {
      const { configureStep, config } = createInitializedModule(['http://localhost']);
      dom.reconfigure({
        url: 'https://localhost/blocklisted/url'
      });
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });
  });

  describe('block mode with dynamic provider', () => {
    const createInitializedModule = (
      patterns: string[]
    ): { configureStep: ConfigureStep; module: BlocklistedUrls; config: MoliConfig } => {
      const config = newEmptyConfig();

      const blocklistConfig: BlocklistUrlsBlockingConfig = {
        enabled: true,
        mode: 'block',
        blocklist: dynamicBlocklistProvider
      };

      const module = createAndConfigureModule(blocklistConfig);

      const init = module.initSteps(assetLoaderService)[0];
      loadJsonStub.resolves(blocklist(patterns));

      expect(init).to.be.ok;

      const initSteps = module.initSteps(assetLoaderService);
      expect(initSteps).to.have.length(1);

      return { configureStep: initSteps[0], module, config };
    };

    it('should add a configure step that resolves if no blocklisted urls are defined', () => {
      const { configureStep, config } = createInitializedModule([]);
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });

    it('should add a configure step that resolves if no blocklisted urls are found', () => {
      const { configureStep, config } = createInitializedModule(['foo']);
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });

    describe('configure step that rejects if a url is blocklisted', () => {
      [
        '/blocklisted',
        'blocklisted',
        'localhost',
        'https://localhost',
        '^https://localhost/blocklisted/url$'
      ].forEach(pattern =>
        it(`should match pattern ${pattern}`, () => {
          const { configureStep, config } = createInitializedModule([pattern]);
          dom.reconfigure({
            url: 'https://localhost/blocklisted/url'
          });
          return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
        })
      );
    });

    it('should ignore invalid patterns', () => {
      const { configureStep, config } = createInitializedModule(['http://localhost']);
      dom.reconfigure({
        url: 'https://localhost/blocklisted/url'
      });
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });

    /*
    it('should fetch the blocklist only once', () => {
      const { configureStep, config } = createInitializedModule([]);

      const calls = [1, 2, 3].map(_ => configureStep(adPipelineContext(config), []));

      return Promise.all(calls).then(() => {
        expect(loadJsonStub).to.have.been.calledOnce;
        expect(loadJsonStub).to.have.been.calledOnceWithExactly(
          'blocklist-urls.json',
          dynamicBlocklistProvider.endpoint
        );
      });
    });*/
  });
});
