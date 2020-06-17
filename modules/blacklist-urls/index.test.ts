import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import BlacklistUrls, {
  IBlacklist,
  IDynamicBlacklistProvider,
  IStaticBlacklistProvider
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
describe('BlacklistUrls Module', () => {

  const sandbox = Sinon.createSandbox();
  const dom = createDom();

  const assetLoaderService = createAssetLoaderService(dom.window);
  const loadJsonStub = sandbox.stub(assetLoaderService, 'loadJson');

  const googletagStub = createGoogletagStub();
  const setTargetingSpy = sandbox.spy(googletagStub.pubads(), 'setTargeting');

  dom.window.googletag = googletagStub;

  const emptyBlacklist: IBlacklist = { urls: [] };

  const blacklist = (patterns: string[], matchType: 'regex' | 'contains' | 'exact' = 'regex'): IBlacklist => {
    return {
      urls: patterns.map(pattern => {
        return { pattern, matchType };
      })
    };
  };

  const staticBlacklistProvider = (patterns: string[] = [], matchType: 'regex' | 'contains' | 'exact' = 'regex'): IStaticBlacklistProvider => {
    return { provider: 'static', blacklist: blacklist(patterns, matchType) };
  };

  const dynamicBlacklistProvider: IDynamicBlacklistProvider = {
    provider: 'dynamic',
    endpoint: 'http://localhost/blacklist.json'
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
    loadJsonStub.resolves(emptyBlacklist);
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should configure nothing in test mode', () => {
    const testConfig: Moli.MoliConfig = { ...newEmptyConfig(), environment: 'test' };
    const module = new BlacklistUrls({
      mode: 'block', blacklist: staticBlacklistProvider()
    }, dom.window);

    module.init(testConfig, assetLoaderService);
    expect(testConfig.pipeline).to.be.undefined;
  });

  describe('block mode with static provider', () => {

    const createInitializedModule = (patterns: string[]): { configureStep: ConfigureStep, module: BlacklistUrls, config: Moli.MoliConfig } => {
      const config = newEmptyConfig();
      const module = new BlacklistUrls({
        mode: 'block', blacklist: staticBlacklistProvider(patterns)
      }, dom.window);
      module.init(config, assetLoaderService);

      expect(config.pipeline).to.be.ok;
      const steps = config.pipeline!.configureSteps;
      expect(steps).to.have.length(1);
      return { configureStep: steps[0], module, config };
    };

    it('should add a configure step that resolves if no blacklisted urls are defined', () => {
      const { configureStep, config } = createInitializedModule([]);
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });

    it('should add a configure step that resolves if no blacklisted urls are found', () => {
      const { configureStep, config } = createInitializedModule([ 'foo' ]);
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });

    describe('configure step that rejects if a url is blacklisted', () => {
      [
        '/blacklisted',
        'blacklisted',
        'localhost',
        'https:\/\/localhost',
        '^https:\/\/localhost/blacklisted/url$'
      ].forEach(pattern => it(`should match pattern ${pattern}`, () => {
        const { configureStep, config } = createInitializedModule([ pattern ]);
        dom.reconfigure({
          url: 'https://localhost/blacklisted/url'
        });
        return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
      }));
    });

    it('should ignore invalid patterns', () => {
      const { configureStep, config } = createInitializedModule([ 'http://localhost' ]);
      dom.reconfigure({
        url: 'https://localhost/blacklisted/url'
      });
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });
  });

  describe('block mode with dynamic provider', () => {

    const createInitializedModule = (patterns: string[]): { configureStep: ConfigureStep, module: BlacklistUrls, config: Moli.MoliConfig } => {
      const config = newEmptyConfig();
      const module = new BlacklistUrls({ mode: 'block', blacklist: dynamicBlacklistProvider }, dom.window);
      module.init(config, assetLoaderService);

      // stub the asset call
      loadJsonStub.resolves(blacklist(patterns));

      expect(config.pipeline).to.be.ok;
      const steps = config.pipeline!.configureSteps;
      expect(steps).to.have.length(1);
      return { configureStep: steps[0], module, config };
    };

    it('should add a configure step that resolves if no blacklisted urls are defined', () => {
      const { configureStep, config } = createInitializedModule([]);
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });

    it('should add a configure step that resolves if no blacklisted urls are found', () => {
      const { configureStep, config } = createInitializedModule([ 'foo' ]);
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });

    describe('configure step that rejects if a url is blacklisted', () => {
      [
        '/blacklisted',
        'blacklisted',
        'localhost',
        'https:\/\/localhost',
        '^https:\/\/localhost/blacklisted/url$'
      ].forEach(pattern => it(`should match pattern ${pattern}`, () => {
        const { configureStep, config } = createInitializedModule([ pattern ]);
        dom.reconfigure({
          url: 'https://localhost/blacklisted/url'
        });
        return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
      }));
    });

    it('should ignore invalid patterns', () => {
      const { configureStep, config } = createInitializedModule([ 'http://localhost' ]);
      dom.reconfigure({
        url: 'https://localhost/blacklisted/url'
      });
      return expect(configureStep(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });

    it('should fetch the blacklist only once', () => {
      const { configureStep, config } = createInitializedModule([]);

      const calls = [ 1, 2, 3 ].map(_ => configureStep(adPipelineContext(config), []));

      return Promise.all(calls).then(() => {
        expect(loadJsonStub).to.have.been.calledOnce;
        expect(loadJsonStub).to.have.been.calledOnceWithExactly('blacklist-urls.json', dynamicBlacklistProvider.endpoint);
      });
    });
  });

  describe('key-value mode with static provider', () => {

    const createInitializedModule = (patterns: string[], isBlacklistedValue?: string): { prepareRequestAdsSteps: PrepareRequestAdsStep, module: BlacklistUrls, config: Moli.MoliConfig } => {
      const config = newEmptyConfig();
      const module = new BlacklistUrls({
        mode: 'key-value', key: 'isBlacklisted', isBlacklistedValue, blacklist: staticBlacklistProvider(patterns)
      }, dom.window);
      module.init(config, assetLoaderService);

      expect(config.pipeline).to.be.ok;
      const steps = config.pipeline!.prepareRequestAdsSteps;
      expect(steps).to.have.length(1);
      return { prepareRequestAdsSteps: steps[0], module, config };
    };

    it('should add a prepareRequestAds step that sets not key values if no blacklisted urls are defined', () => {
      const { prepareRequestAdsSteps, config } = createInitializedModule([]);
      return prepareRequestAdsSteps(adPipelineContext(config), []).then(() => {
        expect(setTargetingSpy).to.have.not.been.called;
      });
    });

    it('should add a prepareRequestAds step that resolves if no blacklisted urls are found', () => {
      const { prepareRequestAdsSteps, config } = createInitializedModule([ 'foo' ]);
      return prepareRequestAdsSteps(adPipelineContext(config), []).then(() => {
        expect(setTargetingSpy).to.have.not.been.called;
      });
    });

    describe('prepareRequestAds step that sets the specified key-value if a url is blacklisted', () => {

      beforeEach(() => {
        dom.reconfigure({
          url: 'https://localhost/blacklisted/url'
        });
      });

      [
        '/blacklisted',
        'blacklisted',
        'localhost',
        'https:\/\/localhost',
        '^https:\/\/localhost/blacklisted/url$'
      ].forEach(pattern => it(`should match pattern ${pattern}`, () => {
        const { prepareRequestAdsSteps, config } = createInitializedModule([ pattern ]);
        return prepareRequestAdsSteps(adPipelineContext(config), []).then(() => {
          expect(setTargetingSpy).to.have.been.calledOnce;
          expect(setTargetingSpy).to.have.been.calledOnceWithExactly('isBlacklisted', 'true');
        });
      }));

      it('should set a custom key-value value', () => {
        const { prepareRequestAdsSteps, config } = createInitializedModule([ 'blacklisted' ], 'yes');
        return prepareRequestAdsSteps(adPipelineContext(config), []).then(() => {
          expect(setTargetingSpy).to.have.been.calledOnce;
          expect(setTargetingSpy).to.have.been.calledOnceWithExactly('isBlacklisted', 'yes');
        });
      });
    });

    it('should ignore invalid patterns', () => {
      const { prepareRequestAdsSteps, config } = createInitializedModule([ 'http://localhost' ]);
      dom.reconfigure({
        url: 'https://localhost/blacklisted/url'
      });
      return expect(prepareRequestAdsSteps(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });
  });

  describe('key-value mode with static provider', () => {

    const createInitializedModule = (patterns: string[], isBlacklistedValue?: string): { prepareRequestAdsSteps: PrepareRequestAdsStep, module: BlacklistUrls, config: Moli.MoliConfig } => {
      const config = newEmptyConfig();
      const module = new BlacklistUrls({
        mode: 'key-value', key: 'isBlacklisted', isBlacklistedValue, blacklist: dynamicBlacklistProvider
      }, dom.window);
      module.init(config, assetLoaderService);

      // stub the asset call
      loadJsonStub.resolves(blacklist(patterns));

      expect(config.pipeline).to.be.ok;
      const steps = config.pipeline!.prepareRequestAdsSteps;
      expect(steps).to.have.length(1);
      return { prepareRequestAdsSteps: steps[0], module, config };
    };

    it('should add a prepareRequestAds step that sets not key values if no blacklisted urls are defined', () => {
      const { prepareRequestAdsSteps, config } = createInitializedModule([]);
      return prepareRequestAdsSteps(adPipelineContext(config), []).then(() => {
        expect(setTargetingSpy).to.have.not.been.called;
      });
    });

    it('should add a prepareRequestAds step that resolves if no blacklisted urls are found', () => {
      const { prepareRequestAdsSteps, config } = createInitializedModule([ 'foo' ]);
      return prepareRequestAdsSteps(adPipelineContext(config), []).then(() => {
        expect(setTargetingSpy).to.have.not.been.called;
      });
    });

    describe('prepareRequestAds step that sets the specified key-value if a url is blacklisted', () => {

      beforeEach(() => {
        dom.reconfigure({
          url: 'https://localhost/blacklisted/url'
        });
      });

      [
        '/blacklisted',
        'blacklisted',
        'localhost',
        'https:\/\/localhost',
        '^https:\/\/localhost/blacklisted/url$'
      ].forEach(pattern => it(`should match pattern ${pattern}`, () => {
        const { prepareRequestAdsSteps, config } = createInitializedModule([ pattern ]);
        return prepareRequestAdsSteps(adPipelineContext(config), []).then(() => {
          expect(setTargetingSpy).to.have.been.calledOnce;
          expect(setTargetingSpy).to.have.been.calledOnceWithExactly('isBlacklisted', 'true');
        });
      }));

      it('should set a custom key-value value', () => {
        const { prepareRequestAdsSteps, config } = createInitializedModule([ 'blacklisted' ], 'yes');
        return prepareRequestAdsSteps(adPipelineContext(config), []).then(() => {
          expect(setTargetingSpy).to.have.been.calledOnce;
          expect(setTargetingSpy).to.have.been.calledOnceWithExactly('isBlacklisted', 'yes');
        });
      });
    });

    it('should ignore invalid patterns', () => {
      const { prepareRequestAdsSteps, config } = createInitializedModule([ 'http://localhost' ]);
      dom.reconfigure({
        url: 'https://localhost/blacklisted/url'
      });
      return expect(prepareRequestAdsSteps(adPipelineContext(config), [])).to.eventually.not.be.rejected;
    });

    it('should fetch the blacklist only once', () => {
      const { prepareRequestAdsSteps, config } = createInitializedModule([]);

      const calls = [ 1, 2, 3 ].map(_ => prepareRequestAdsSteps(adPipelineContext(config), []));

      return Promise.all(calls).then(() => {
        expect(loadJsonStub).to.have.been.calledOnce;
        expect(loadJsonStub).to.have.been.calledOnceWithExactly('blacklist-urls.json', dynamicBlacklistProvider.endpoint);
      });
    });
  });

  describe('isBlacklisted method', () => {

    // the isBlacklisted method is stateless
    const module = new BlacklistUrls({
      mode: 'block', blacklist: staticBlacklistProvider()
    }, dom.window);

    describe('matchType: regex', () => {
      it('is not blacklisted for empty urls array', () => {
        const isBlacklisted = module.isBlacklisted(blacklist([], 'regex'), 'http://www.example.com', noopLogger);
        expect(isBlacklisted).to.be.false;
      });

      it('is not blacklisted if no url matches', () => {
        const isBlacklisted = module.isBlacklisted(blacklist([
          'foo', 'bar'
        ], 'regex'), 'http://www.example.com', noopLogger);
        expect(isBlacklisted).to.be.false;
      });

      it('is not blacklisted if the pattern is not a valid regex', () => {
        const isBlacklisted = module.isBlacklisted(blacklist([
          //  it seems to be impossible to create an invalid regex in js
          '$example^' as any
        ], 'regex'), 'http://www.example.com', noopLogger);
        expect(isBlacklisted).to.be.false;
      });

      it('is blacklisted if an url matches', () => {
        const isBlacklisted = module.isBlacklisted(blacklist([ 'example\.com$' ], 'regex'), 'http://www.example.com', noopLogger);
        expect(isBlacklisted).to.be.true;
      });

    });

    describe('matchType: contains', () => {
      it('is not blacklisted for empty urls array', () => {
        const isBlacklisted = module.isBlacklisted(blacklist([], 'contains'), 'http://www.example.com', noopLogger);
        expect(isBlacklisted).to.be.false;
      });

      it('is not blacklisted if no url matches', () => {
        const isBlacklisted = module.isBlacklisted(blacklist([
          'foo', 'bar'
        ], 'contains'), 'http://www.example.com', noopLogger);
        expect(isBlacklisted).to.be.false;
      });


      it('is blacklisted if an url matches', () => {
        const isBlacklisted = module.isBlacklisted(blacklist([ 'http://www.example' ], 'contains'), 'http://www.example.com', noopLogger);
        expect(isBlacklisted).to.be.true;
      });

    });

    describe('matchType: exact', () => {
      it('is not blacklisted for empty urls array', () => {
        const isBlacklisted = module.isBlacklisted(blacklist([], 'exact'), 'http://www.example.com', noopLogger);
        expect(isBlacklisted).to.be.false;
      });

      it('is not blacklisted if no url matches', () => {
        const isBlacklisted = module.isBlacklisted(blacklist([
          'http://www.example.de', 'bar'
        ], 'exact'), 'http://www.example.com', noopLogger);
        expect(isBlacklisted).to.be.false;
      });


      it('is blacklisted if an url matches', () => {
        const isBlacklisted = module.isBlacklisted(blacklist([ 'http://www.example.com' ], 'exact'), 'http://www.example.com', noopLogger);
        expect(isBlacklisted).to.be.true;
      });

    });

  });

});

// tslint:enable
