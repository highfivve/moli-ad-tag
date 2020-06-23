import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import BlocklistUrls, {
  IBlocklist,
  IDynamicBlocklistProvider,
  IStaticBlocklistProvider
} from './index';
import {
  Moli,
  createAssetLoaderService,
  AdPipelineContext,
  ConfigureStep,
  PrepareRequestAdsStep
} from '@highfivve/ad-tag';
import { newEmptyConfig, noopLogger } from '@highfivve/ad-tag/tests/ts/stubs/moliStubs';
import { createDom } from '@highfivve/ad-tag/tests/ts/stubs/browserEnvSetup';
import { createGoogletagStub } from '@highfivve/ad-tag/tests/ts/stubs/googletagStubs';


// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

// tslint:disable: no-unused-expression
describe('BlocklistUrls Module', () => {

  const sandbox = Sinon.createSandbox();
  const dom = createDom();

  const assetLoaderService = createAssetLoaderService(dom.window);
  const loadJsonStub = sandbox.stub(assetLoaderService, 'loadJson');

  const googletagStub = createGoogletagStub();
  const setTargetingSpy = sandbox.spy(googletagStub.pubads(), 'setTargeting');

  dom.window.googletag = googletagStub;

  const emptyBlocklist: IBlocklist = { urls: [] };

  const blocklist = (patterns: string[], matchType: 'regex' | 'contains' | 'exact' = 'regex'): IBlocklist => {
    return {
      urls: patterns.map(pattern => {
        return { pattern, matchType };
      })
    };
  };

  const staticBlocklistProvider = (patterns: string[] = [], matchType: 'regex' | 'contains' | 'exact' = 'regex'): IStaticBlocklistProvider => {
    return { provider: 'static', blocklist: blocklist(patterns, matchType) };
  };

  const dynamicBlocklistProvider: IDynamicBlocklistProvider = {
    provider: 'dynamic',
    endpoint: 'http://localhost/blocklist.json'
  };

  const adPipelineContext = (config: Moli.MoliConfig): AdPipelineContext => {
    return {
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: noopLogger,
      config: config,
      window: dom.window,
      // no service dependencies required
      labelConfigService: null as any,
      reportingService: null as any,
      slotEventService: null as any
    };
  };

  beforeEach(() => {
    loadJsonStub.resolves(emptyBlocklist);
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should configure nothing in test mode', () => {
    const testConfig: Moli.MoliConfig = { ...newEmptyConfig(), environment: 'test' };
    const module = new BlocklistUrls({
      mode: 'block', blocklist: staticBlocklistProvider()
    }, dom.window);

    module.init(testConfig, assetLoaderService);
    expect(testConfig.pipeline).to.be.undefined;
  });

  describe('block mode with static provider', () => {

    const createInitializedModule = (patterns: string[]): { configureStep: ConfigureStep, module: BlocklistUrls, config: Moli.MoliConfig } => {
      const config = newEmptyConfig();
      const module = new BlocklistUrls({
        mode: 'block', blocklist: staticBlocklistProvider(patterns)
      }, dom.window);
      module.init(config, assetLoaderService);

      expect(config.pipeline).to.be.ok;
      const steps = config.pipeline!.configureSteps;
      expect(steps).to.have.length(1);
      return { configureStep: steps[0], module, config };
    };

    it('should add a configure step that resolves if no blocklisted urls are defined', () => {
      const { configureStep, config } = createInitializedModule([]);
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });

    it('should add a configure step that resolves if no blocklisted urls are found', () => {
      const { configureStep, config } = createInitializedModule([ 'foo' ]);
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });

    describe('configure step that rejects if a url is blocklisted', () => {
      [
        '/blocklisted',
        'blocklisted',
        'localhost',
        'https:\/\/localhost',
        '^https:\/\/localhost/blocklisted/url$'
      ].forEach(pattern => it(`should match pattern ${pattern}`, () => {
        const { configureStep, config } = createInitializedModule([ pattern ]);
        dom.reconfigure({
          url: 'https://localhost/blocklisted/url'
        });
        return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
      }));
    });

    it('should ignore invalid patterns', () => {
      const { configureStep, config } = createInitializedModule([ 'http://localhost' ]);
      dom.reconfigure({
        url: 'https://localhost/blocklisted/url'
      });
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });
  });

  describe('block mode with dynamic provider', () => {

    const createInitializedModule = (patterns: string[]): { configureStep: ConfigureStep, module: BlocklistUrls, config: Moli.MoliConfig } => {
      const config = newEmptyConfig();
      const module = new BlocklistUrls({ mode: 'block', blocklist: dynamicBlocklistProvider }, dom.window);
      module.init(config, assetLoaderService);

      // stub the asset call
      loadJsonStub.resolves(blocklist(patterns));

      expect(config.pipeline).to.be.ok;
      const steps = config.pipeline!.configureSteps;
      expect(steps).to.have.length(1);
      return { configureStep: steps[0], module, config };
    };

    it('should add a configure step that resolves if no blocklisted urls are defined', () => {
      const { configureStep, config } = createInitializedModule([]);
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });

    it('should add a configure step that resolves if no blocklisted urls are found', () => {
      const { configureStep, config } = createInitializedModule([ 'foo' ]);
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });

    describe('configure step that rejects if a url is blocklisted', () => {
      [
        '/blocklisted',
        'blocklisted',
        'localhost',
        'https:\/\/localhost',
        '^https:\/\/localhost/blocklisted/url$'
      ].forEach(pattern => it(`should match pattern ${pattern}`, () => {
        const { configureStep, config } = createInitializedModule([ pattern ]);
        dom.reconfigure({
          url: 'https://localhost/blocklisted/url'
        });
        return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
      }));
    });

    it('should ignore invalid patterns', () => {
      const { configureStep, config } = createInitializedModule([ 'http://localhost' ]);
      dom.reconfigure({
        url: 'https://localhost/blocklisted/url'
      });
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });

    it('should fetch the blocklist only once', () => {
      const { configureStep, config } = createInitializedModule([]);

      const calls = [ 1, 2, 3 ].map(_ => configureStep(adPipelineContext(config), []));

      return Promise.all(calls).then(() => {
        expect(loadJsonStub).to.have.been.calledOnce;
        expect(loadJsonStub).to.have.been.calledOnceWithExactly('blocklist-urls.json', dynamicBlocklistProvider.endpoint);
      });
    });
  });

  describe('key-value mode with static provider', () => {

    const createInitializedModule = (patterns: string[], isBlocklistedValue?: string): { prepareRequestAdsSteps: PrepareRequestAdsStep, module: BlocklistUrls, config: Moli.MoliConfig } => {
      const config = newEmptyConfig();
      const module = new BlocklistUrls({
        mode: 'key-value', key: 'isBlocklisted', isBlocklistedValue, blocklist: staticBlocklistProvider(patterns)
      }, dom.window);
      module.init(config, assetLoaderService);

      expect(config.pipeline).to.be.ok;
      const steps = config.pipeline!.prepareRequestAdsSteps;
      expect(steps).to.have.length(1);
      return { prepareRequestAdsSteps: steps[0], module, config };
    };

    it('should add a prepareRequestAds step that sets not key values if no blocklisted urls are defined', () => {
      const { prepareRequestAdsSteps, config } = createInitializedModule([]);
      return prepareRequestAdsSteps(adPipelineContext(config), []).then(() => {
        expect(setTargetingSpy).to.have.not.been.called;
      });
    });

    it('should add a prepareRequestAds step that resolves if no blocklisted urls are found', () => {
      const { prepareRequestAdsSteps, config } = createInitializedModule([ 'foo' ]);
      return prepareRequestAdsSteps(adPipelineContext(config), []).then(() => {
        expect(setTargetingSpy).to.have.not.been.called;
      });
    });

    describe('prepareRequestAds step that sets the specified key-value if a url is blocklisted', () => {

      beforeEach(() => {
        dom.reconfigure({
          url: 'https://localhost/blocklisted/url'
        });
      });

      [
        '/blocklisted',
        'blocklisted',
        'localhost',
        'https:\/\/localhost',
        '^https:\/\/localhost/blocklisted/url$'
      ].forEach(pattern => it(`should match pattern ${pattern}`, () => {
        const { prepareRequestAdsSteps, config } = createInitializedModule([ pattern ]);
        return prepareRequestAdsSteps(adPipelineContext(config), []).then(() => {
          expect(setTargetingSpy).to.have.been.calledOnce;
          expect(setTargetingSpy).to.have.been.calledOnceWithExactly('isBlocklisted', 'true');
        });
      }));

      it('should set a custom key-value value', () => {
        const { prepareRequestAdsSteps, config } = createInitializedModule([ 'blocklisted' ], 'yes');
        return prepareRequestAdsSteps(adPipelineContext(config), []).then(() => {
          expect(setTargetingSpy).to.have.been.calledOnce;
          expect(setTargetingSpy).to.have.been.calledOnceWithExactly('isBlocklisted', 'yes');
        });
      });
    });

    it('should ignore invalid patterns', () => {
      const { prepareRequestAdsSteps, config } = createInitializedModule([ 'http://localhost' ]);
      dom.reconfigure({
        url: 'https://localhost/blocklisted/url'
      });
      return expect(prepareRequestAdsSteps(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });
  });

  describe('key-value mode with static provider', () => {

    const createInitializedModule = (patterns: string[], isBlocklistedValue?: string): { prepareRequestAdsSteps: PrepareRequestAdsStep, module: BlocklistUrls, config: Moli.MoliConfig } => {
      const config = newEmptyConfig();
      const module = new BlocklistUrls({
        mode: 'key-value', key: 'isBlocklisted', isBlocklistedValue, blocklist: dynamicBlocklistProvider
      }, dom.window);
      module.init(config, assetLoaderService);

      // stub the asset call
      loadJsonStub.resolves(blocklist(patterns));

      expect(config.pipeline).to.be.ok;
      const steps = config.pipeline!.prepareRequestAdsSteps;
      expect(steps).to.have.length(1);
      return { prepareRequestAdsSteps: steps[0], module, config };
    };

    it('should add a prepareRequestAds step that sets not key values if no blocklisted urls are defined', () => {
      const { prepareRequestAdsSteps, config } = createInitializedModule([]);
      return prepareRequestAdsSteps(adPipelineContext(config), []).then(() => {
        expect(setTargetingSpy).to.have.not.been.called;
      });
    });

    it('should add a prepareRequestAds step that resolves if no blocklisted urls are found', () => {
      const { prepareRequestAdsSteps, config } = createInitializedModule([ 'foo' ]);
      return prepareRequestAdsSteps(adPipelineContext(config), []).then(() => {
        expect(setTargetingSpy).to.have.not.been.called;
      });
    });

    describe('prepareRequestAds step that sets the specified key-value if a url is blocklisted', () => {

      beforeEach(() => {
        dom.reconfigure({
          url: 'https://localhost/blocklisted/url'
        });
      });

      [
        '/blocklisted',
        'blocklisted',
        'localhost',
        'https:\/\/localhost',
        '^https:\/\/localhost/blocklisted/url$'
      ].forEach(pattern => it(`should match pattern ${pattern}`, () => {
        const { prepareRequestAdsSteps, config } = createInitializedModule([ pattern ]);
        return prepareRequestAdsSteps(adPipelineContext(config), []).then(() => {
          expect(setTargetingSpy).to.have.been.calledOnce;
          expect(setTargetingSpy).to.have.been.calledOnceWithExactly('isBlocklisted', 'true');
        });
      }));

      it('should set a custom key-value value', () => {
        const { prepareRequestAdsSteps, config } = createInitializedModule([ 'blocklisted' ], 'yes');
        return prepareRequestAdsSteps(adPipelineContext(config), []).then(() => {
          expect(setTargetingSpy).to.have.been.calledOnce;
          expect(setTargetingSpy).to.have.been.calledOnceWithExactly('isBlocklisted', 'yes');
        });
      });
    });

    it('should ignore invalid patterns', () => {
      const { prepareRequestAdsSteps, config } = createInitializedModule([ 'http://localhost' ]);
      dom.reconfigure({
        url: 'https://localhost/blocklisted/url'
      });
      return expect(prepareRequestAdsSteps(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });

    it('should fetch the blocklist only once', () => {
      const { prepareRequestAdsSteps, config } = createInitializedModule([]);

      const calls = [ 1, 2, 3 ].map(_ => prepareRequestAdsSteps(adPipelineContext(config), []));

      return Promise.all(calls).then(() => {
        expect(loadJsonStub).to.have.been.calledOnce;
        expect(loadJsonStub).to.have.been.calledOnceWithExactly('blocklist-urls.json', dynamicBlocklistProvider.endpoint);
      });
    });
  });

  describe('isBlocklisted method', () => {

    // the isBlocklisted method is stateless
    const module = new BlocklistUrls({
      mode: 'block', blocklist: staticBlocklistProvider()
    }, dom.window);

    describe('matchType: regex', () => {
      it('is not blocklisted for empty urls array', () => {
        const isBlocklisted = module.isBlocklisted(blocklist([], 'regex'), 'http://www.example.com', noopLogger);
        expect(isBlocklisted).to.be.false;
      });

      it('is not blocklisted if no url matches', () => {
        const isBlocklisted = module.isBlocklisted(blocklist([
          'foo', 'bar'
        ], 'regex'), 'http://www.example.com', noopLogger);
        expect(isBlocklisted).to.be.false;
      });

      it('is not blocklisted if the pattern is not a valid regex', () => {
        const isBlocklisted = module.isBlocklisted(blocklist([
          //  it seems to be impossible to create an invalid regex in js
          '$example^' as any
        ], 'regex'), 'http://www.example.com', noopLogger);
        expect(isBlocklisted).to.be.false;
      });

      it('is blocklisted if an url matches', () => {
        const isBlocklisted = module.isBlocklisted(blocklist([ 'example\.com$' ], 'regex'), 'http://www.example.com', noopLogger);
        expect(isBlocklisted).to.be.true;
      });

    });

    describe('matchType: contains', () => {
      it('is not blocklisted for empty urls array', () => {
        const isBlocklisted = module.isBlocklisted(blocklist([], 'contains'), 'http://www.example.com', noopLogger);
        expect(isBlocklisted).to.be.false;
      });

      it('is not blocklisted if no url matches', () => {
        const isBlocklisted = module.isBlocklisted(blocklist([
          'foo', 'bar'
        ], 'contains'), 'http://www.example.com', noopLogger);
        expect(isBlocklisted).to.be.false;
      });


      it('is blocklisted if an url matches', () => {
        const isBlocklisted = module.isBlocklisted(blocklist([ 'http://www.example' ], 'contains'), 'http://www.example.com', noopLogger);
        expect(isBlocklisted).to.be.true;
      });

    });

    describe('matchType: exact', () => {
      it('is not blocklisted for empty urls array', () => {
        const isBlocklisted = module.isBlocklisted(blocklist([], 'exact'), 'http://www.example.com', noopLogger);
        expect(isBlocklisted).to.be.false;
      });

      it('is not blocklisted if no url matches', () => {
        const isBlocklisted = module.isBlocklisted(blocklist([
          'http://www.example.de', 'bar'
        ], 'exact'), 'http://www.example.com', noopLogger);
        expect(isBlocklisted).to.be.false;
      });


      it('is blocklisted if an url matches', () => {
        const isBlocklisted = module.isBlocklisted(blocklist([ 'http://www.example.com' ], 'exact'), 'http://www.example.com', noopLogger);
        expect(isBlocklisted).to.be.true;
      });

    });

  });

});

// tslint:enable
