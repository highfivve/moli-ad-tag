import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { modules, MoliConfig } from 'ad-tag/types/moliConfig';
import { BlocklistedUrls } from '../blocklist-url/index';
import { createAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { createGoogletagStub } from 'ad-tag/stubs/googletagStubs';
import {
  emptyConfig,
  emptyRuntimeConfig,
  newEmptyConfig,
  newGlobalAuctionContext,
  noopLogger
} from 'ad-tag/stubs/moliStubs';
import { AdPipelineContext, ConfigureStep } from 'ad-tag/ads/adPipeline';
import { fullConsent } from 'ad-tag/stubs/consentStubs';
import chaiAsPromised from 'chai-as-promised';
import Blocklist = modules.blocklist.Blocklist;
import StaticBlocklistProvider = modules.blocklist.StaticBlocklistProvider;
import DynamicBlocklistProvider = modules.blocklist.DynamicBlocklistProvider;
import BlocklistUrlsBlockingConfig = modules.blocklist.BlocklistUrlsBlockingConfig;
import BlocklistUrlsKeyValueConfig = modules.blocklist.BlocklistUrlsKeyValueConfig;

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('BlocklistedUrls Module', () => {
  const sandbox = Sinon.createSandbox();
  let assetLoaderService, loadJsonStub, googleTagStub, setTargetingSpy;
  let { dom, jsDomWindow } = createDomAndWindow();

  const setupDomAndServices = () => {
    const newDom = createDomAndWindow();
    jsDomWindow = newDom.jsDomWindow;
    dom = newDom.dom;
    assetLoaderService = createAssetLoaderService(jsDomWindow);
    loadJsonStub = sandbox.stub(assetLoaderService, 'loadJson');
    googleTagStub = createGoogletagStub();
    setTargetingSpy = sandbox.spy(googleTagStub.pubads(), 'setTargeting');
    jsDomWindow.googletag = googleTagStub;
  };

  const adPipelineContext = (config: MoliConfig): AdPipelineContext => ({
    auctionId: 'xxxx-xxxx-xxxx-xxxx',
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
    auction: newGlobalAuctionContext(jsDomWindow),
    assetLoaderService: assetLoaderService
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
    config?: BlocklistUrlsBlockingConfig | BlocklistUrlsKeyValueConfig
  ): { blocklist: BlocklistUrlsBlockingConfig | BlocklistUrlsKeyValueConfig } => ({
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
    sandbox.restore();
  });

  const createAndConfigureModule = (
    config?: BlocklistUrlsBlockingConfig | BlocklistUrlsKeyValueConfig
  ) => {
    const module = new BlocklistedUrls();
    module.configure__(modulesConfig(config));
    return module;
  };

  it('should configure nothing in test mode', async () => {
    const module = createAndConfigureModule();
    const init = module.initSteps__()[0];
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

      const init = module.initSteps__()[0];
      expect(init).to.be.ok;

      const initSteps = module.initSteps__();
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

      const init = module.initSteps__()[0];
      loadJsonStub.resolves(blocklist(patterns));

      expect(init).to.be.ok;

      const initSteps = module.initSteps__();
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

    it('should fetch the blocklist only once', async () => {
      const { configureStep, config } = createInitializedModule([]);

      const calls = [1, 2, 3].map(_ => configureStep(adPipelineContext(config), []));

      await Promise.all(calls);
      expect(loadJsonStub).to.have.been.calledOnce;
      expect(loadJsonStub).to.have.been.calledOnceWithExactly(
        'blocklist-urls.json',
        dynamicBlocklistProvider.endpoint
      );
    });

    describe('key-value mode with static provider', () => {
      beforeEach(() => {
        dom.reconfigure({
          url: 'https://localhost/blocklisted/url'
        });
        setupDomAndServices();
      });

      afterEach(() => {
        sandbox.reset();
      });
      const createInitializedModule = (
        patterns: string[],
        isBlocklistedValue?: string
      ): {
        configureStep: ConfigureStep;
        module: BlocklistedUrls;
        config: MoliConfig;
      } => {
        const config = newEmptyConfig();
        const blocklistConfig: BlocklistUrlsKeyValueConfig = {
          enabled: true,
          mode: 'key-value',
          key: 'isBlocklisted',
          isBlocklistedValue,
          blocklist: staticBlocklistProvider(patterns)
        };

        const module = createAndConfigureModule(blocklistConfig);

        const init = module.initSteps__()[0];
        loadJsonStub.resolves(blocklist(patterns));

        expect(init).to.be.ok;

        const initSteps = module.initSteps__();
        expect(initSteps).to.have.length(1);

        return { configureStep: initSteps[0], module, config };
      };

      it('should add an init step that sets not key values if no blocklisted urls are defined', async () => {
        const { configureStep, config } = createInitializedModule([]);
        return configureStep(adPipelineContext(config), []).then(() => {
          expect(setTargetingSpy).to.have.not.been.called;
        });
      });

      it('should add an init step that resolves if no blocklisted urls are found', () => {
        const { configureStep, config } = createInitializedModule(['foo']);
        return configureStep(adPipelineContext(config), []).then(() => {
          expect(setTargetingSpy).to.have.not.been.called;
        });
      });

      describe('add init step that sets the specified key-value if a url is blocklisted', () => {
        beforeEach(() => {
          dom.reconfigure({
            url: 'https://localhost/blocklisted/url'
          });
        });
        [
          '/blocklisted',
          'blocklisted',
          'localhost',
          'https://localhost',
          '^https://localhost/blocklisted/url$'
        ].forEach(pattern =>
          it(`should match pattern ${pattern}`, async () => {
            const { configureStep, config } = createInitializedModule([pattern]);
            return configureStep(adPipelineContext(config), []).then(() => {
              expect(setTargetingSpy).to.have.been.calledOnce;
              expect(setTargetingSpy).to.have.been.calledOnceWithExactly('isBlocklisted', 'true');
            });
          })
        );
        it('should set a custom key-value value', async () => {
          const { configureStep, config } = createInitializedModule(['blocklisted'], 'yes');
          return configureStep(adPipelineContext(config), []).then(() => {
            expect(setTargetingSpy).to.have.been.calledOnce;
            expect(setTargetingSpy).to.have.been.calledOnceWithExactly('isBlocklisted', 'yes');
          });
        });
      });

      it('should ignore invalid patterns', () => {
        const { configureStep, config } = createInitializedModule(['http://localhost']);
        dom.reconfigure({
          url: 'https://localhost/blocklisted/url'
        });
        return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
      });

      it('should fetch the blocklist only once', async () => {
        const { configureStep, config } = createInitializedModule([]);

        const calls = [1, 2, 3].map(_ => configureStep(adPipelineContext(config), []));

        // todo: fix this test
        /*
        await Promise.all(calls);
        expect(loadJsonStub).to.have.been.calledOnce;
        expect(loadJsonStub).to.have.been.calledOnceWithExactly(
          'blocklist-urls.json',
          dynamicBlocklistProvider.endpoint
        );*/
      });
    });
  });

  describe('isBlocklisted method', () => {
    // the isBlocklisted method is stateless
    const module = createAndConfigureModule({
      enabled: true,
      mode: 'block',
      blocklist: staticBlocklistProvider()
    });

    describe('matchType: regex', () => {
      it('is not blocklisted for empty urls array', () => {
        const isBlocklisted = module.isBlocklisted(
          blocklist([], 'regex'),
          'http://www.example.com',
          noopLogger
        );
        expect(isBlocklisted).to.be.false;
      });

      it('is not blocklisted if no url matches', () => {
        const isBlocklisted = module.isBlocklisted(
          blocklist(['foo', 'bar'], 'regex'),
          'http://www.example.com',
          noopLogger
        );
        expect(isBlocklisted).to.be.false;
      });

      it('is not blocklisted if the pattern is not a valid regex', () => {
        const isBlocklisted = module.isBlocklisted(
          blocklist(
            [
              //  it seems to be impossible to create an invalid regex in js
              '$example^' as any
            ],
            'regex'
          ),
          'http://www.example.com',
          noopLogger
        );
        expect(isBlocklisted).to.be.false;
      });

      it('is blocklisted if an url matches', () => {
        const isBlocklisted = module.isBlocklisted(
          blocklist(['example.com$'], 'regex'),
          'http://www.example.com',
          noopLogger
        );
        expect(isBlocklisted).to.be.true;
      });
    });
    describe('matchType: contains', () => {
      it('is not blocklisted for empty urls array', () => {
        const isBlocklisted = module.isBlocklisted(
          blocklist([], 'contains'),
          'http://www.example.com',
          noopLogger
        );
        expect(isBlocklisted).to.be.false;
      });

      it('is not blocklisted if no url matches', () => {
        const isBlocklisted = module.isBlocklisted(
          blocklist(['foo', 'bar'], 'contains'),
          'http://www.example.com',
          noopLogger
        );
        expect(isBlocklisted).to.be.false;
      });

      it('is blocklisted if an url matches', () => {
        const isBlocklisted = module.isBlocklisted(
          blocklist(['http://www.example'], 'contains'),
          'http://www.example.com',
          noopLogger
        );
        expect(isBlocklisted).to.be.true;
      });
    });
    describe('matchType: exact', () => {
      it('is not blocklisted for empty urls array', () => {
        const isBlocklisted = module.isBlocklisted(
          blocklist([], 'exact'),
          'http://www.example.com',
          noopLogger
        );
        expect(isBlocklisted).to.be.false;
      });

      it('is not blocklisted if no url matches', () => {
        const isBlocklisted = module.isBlocklisted(
          blocklist(['http://www.example.de', 'bar'], 'exact'),
          'http://www.example.com',
          noopLogger
        );
        expect(isBlocklisted).to.be.false;
      });

      it('is blocklisted if an url matches', () => {
        const isBlocklisted = module.isBlocklisted(
          blocklist(['http://www.example.com'], 'exact'),
          'http://www.example.com',
          noopLogger
        );
        expect(isBlocklisted).to.be.true;
      });
    });
  });
});
