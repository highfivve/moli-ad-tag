import { dom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { Moli } from '../../../source/ts/types/moli';
import { createMoliTag } from '../../../source/ts/ads/moli';
import { googletagStub } from '../stubs/googletagStubs';
import { pbjsStub } from '../stubs/prebidjsStubs';
import { consentConfig, noopLogger } from '../stubs/moliStubs';
import IConfigurable = Moli.state.IConfigurable;
import IFinished = Moli.state.IFinished;
import ISinglePageApp = Moli.state.ISinglePageApp;

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('moli', () => {

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  beforeEach(() => {
    dom.window.googletag = googletagStub;
    dom.window.pbjs = pbjsStub;
  });

  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('state machine', () => {

    it('should start in configurable state', () => {
      const adTag = createMoliTag(dom.window);
      expect(adTag.getState()).to.be.eq('configurable');
    });

    it('should stay in configurable state after setTargeting()', () => {
      const adTag = createMoliTag(dom.window);
      adTag.setTargeting('key', 'value');
      expect(adTag.getState()).to.be.eq('configurable');
    });

    it('should transition into configured state after configure()', () => {
      const adTag = createMoliTag(dom.window);
      adTag.configure({ slots: [], consent: consentConfig });
      expect(adTag.getState()).to.be.eq('configured');
    });

    it('should stay in configured state after setTargeting()', () => {
      const adTag = createMoliTag(dom.window);
      adTag.configure({ slots: [], consent: consentConfig });
      adTag.setTargeting('key', 'value');
      expect(adTag.getState()).to.be.eq('configured');
    });

    it('should transition into requestAds state after requestAds()', () => {
      const adTag = createMoliTag(dom.window);
      adTag.configure({ slots: [], consent: consentConfig, logger: noopLogger });
      const finished = adTag.requestAds();
      expect(adTag.getState()).to.be.eq('requestAds');
      return finished.then(state => {
        expect(state.state).to.be.eq('finished');
      });
    });

    it('should stay in configurable state after requestAds() and set initialize to true', () => {
      const adTag = createMoliTag(dom.window);
      const finished = adTag.requestAds();
      expect(adTag.getState()).to.be.eq('configurable');
      return finished.then(state => {
        expect(state.state).to.be.eq('configurable');
        const configurableState: IConfigurable = state as IConfigurable;
        expect(configurableState.initialize).to.be.true;
      });
    });

    it('should stay in spa state if single page app is enabled and requestAds is called multiple times', () => {
      const adTag = createMoliTag(dom.window);
      adTag.enableSinglePageApp();
      adTag.configure({ slots: [], consent: consentConfig, logger: noopLogger });
      expect(adTag.getState()).to.be.eq('configured');
      return adTag.requestAds().then(state => {
        expect(state.state).to.be.eq('spa');
        const spaState: ISinglePageApp = state as ISinglePageApp;
        expect(spaState.config).to.be.ok;
        // location.hash is currently the only supported setter in jsdom
        dom.window.location.hash = 'foo';
        return adTag.requestAds();
      }).then((state) => {
        expect(state.state).to.be.eq('spa');
        const spaState: ISinglePageApp = state as ISinglePageApp;
        expect(spaState.config).to.be.ok;
      });
    });
  });

  describe('setTargeting()', () => {

    it('should add key-values to the config', () => {
      const adTag = createMoliTag(dom.window);
      adTag.setTargeting('pre', 'configure1');
      adTag.configure({ slots: [], consent: consentConfig, logger: noopLogger });
      adTag.setTargeting('post', 'configure2');

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.targeting).to.be.ok;
      expect(config!.targeting!.keyValues).to.be.deep.equals({
        pre: 'configure1',
        post: 'configure2'
      });
    });

    it('should override preexisting values', () => {
      const adTag = createMoliTag(dom.window);
      adTag.setTargeting('pre', 'configure1');
      adTag.configure({
        slots: [], consent: consentConfig, targeting: {
          keyValues: {
            pre: 'dismiss',
            post: 'dismiss'
          }
        }
      });
      adTag.setTargeting('post', 'configure2');

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.targeting).to.be.ok;
      expect(config!.targeting!.keyValues).to.be.deep.equals({
        pre: 'configure1',
        post: 'configure2'
      });
    });

    it('should add ABtest key-value between 1 and 100 in configurable state calling requestAds() ', () => {
      const adTag = createMoliTag(dom.window);
      const finished = adTag.requestAds();
      expect(adTag.getState()).to.be.eq('configurable');
      return finished.then(state => {
        expect(state.state).to.be.eq('configurable');
        const configurableState: IConfigurable = state as IConfigurable;
        expect(configurableState.keyValues).to.be.not.undefined;
        expect(configurableState.keyValues.ABtest).to.be.not.undefined;

        const abTest = Number(configurableState.keyValues.ABtest);
        expect(abTest).to.be.gte(1);
        expect(abTest).to.be.lte(100);
      });
    });

    it('should add ABtest key-value between 1 and 100 in configured state calling requestAds() ', () => {
      const adTag = createMoliTag(dom.window);
      adTag.configure({ slots: [], consent: consentConfig });

      expect(adTag.getState()).to.be.eq('configured');
      return adTag.requestAds().then(state => {
        expect(state.state).to.be.eq('finished');
        const finishedState: IFinished = state as IFinished;
        const config = finishedState.config;
        expect(config.targeting).to.be.not.undefined;
        expect(config.targeting!.keyValues).to.be.not.undefined;
        expect(config.targeting!.keyValues.ABtest).to.be.not.undefined;

        const abTest = Number(config.targeting!.keyValues.ABtest);
        expect(abTest).to.be.gte(1);
        expect(abTest).to.be.lte(100);
      });
    });

  });

  describe('addLabel()', () => {

    it('should add label to the config', () => {
      const adTag = createMoliTag(dom.window);
      adTag.addLabel('pre');
      adTag.configure({ slots: [], consent: consentConfig });
      adTag.addLabel('post');

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.targeting).to.be.ok;
      expect(config!.targeting!.labels).to.be.deep.equals([ 'pre', 'post' ]);
    });

    it('should append to preexisting values', () => {
      const adTag = createMoliTag(dom.window);
      adTag.addLabel('pre');
      adTag.configure({
        slots: [], consent: consentConfig, targeting: {
          keyValues: {},
          labels: [ 'pre-existing' ]
        }
      });
      adTag.addLabel('post');

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.targeting).to.be.ok;
      expect(config!.targeting!.labels).to.be.deep.equals([ 'pre-existing', 'pre', 'post' ]);
    });
  });

  describe('setLogger()', () => {
    it('should set the given logger instance', () => {
      const adTag = createMoliTag(dom.window);
      const customLogger: Moli.MoliLogger = {
        debug: () => {
          return;
        },
        info: () => {
          return;
        },
        warn: () => {
          return;
        },
        error: () => {
          return;
        }
      };

      adTag.setLogger(customLogger);
      adTag.configure({ slots: [], consent: consentConfig });

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.logger).to.be.equal(customLogger);
    });

  });

  describe('setSampleRate()', () => {
    it('should set the given sample rate instance before configure() is called', () => {
      const adTag = createMoliTag(dom.window);

      adTag.setSampleRate(0.23);
      adTag.configure({ slots: [], consent: consentConfig });

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.reporting).to.be.ok;
      expect(config!.reporting!.sampleRate).to.be.equal(0.23);
    });

    it('should set the given sample rate instance after configure() is called', () => {
      const adTag = createMoliTag(dom.window);

      adTag.configure({ slots: [], consent: consentConfig });
      adTag.setSampleRate(0.23);

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.reporting).to.be.ok;
      expect(config!.reporting!.sampleRate).to.be.equal(0.23);
    });

    it('should set the reporters array to an empty array', () => {
      const adTag = createMoliTag(dom.window);

      adTag.configure({ slots: [], consent: consentConfig });
      adTag.setSampleRate(0.23);

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.reporting).to.be.ok;
      expect(config!.reporting!.reporters).to.deep.equal([]);
    });
  });

  describe('addReporter()', () => {
    it('should add the given reporter instances', () => {
      const adTag = createMoliTag(dom.window);

      const voidReporter: Moli.reporting.Reporter = () => {
        return;
      };
      adTag.addReporter(voidReporter);
      adTag.configure({ slots: [], consent: consentConfig });
      adTag.addReporter(voidReporter);

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.reporting).to.be.ok;
      expect(config!.reporting!.reporters).length(2);
      expect(config!.reporting!.reporters).to.deep.equal([ voidReporter, voidReporter ]);
    });

    it('should set the default sampleRate to 0', () => {
      const adTag = createMoliTag(dom.window);

      const voidReporter: Moli.reporting.Reporter = () => {
        return;
      };
      adTag.addReporter(voidReporter);
      adTag.configure({ slots: [], consent: consentConfig });

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.reporting).to.be.ok;
      expect(config!.reporting!.sampleRate).to.be.equal(0);
    });

  });

  describe('hooks', () => {
    it('should add the beforeRequestAds hook and call it', () => {
      const adTag = createMoliTag(dom.window);

      const beforeRequestAdsHook = (_: Moli.MoliConfig) => {
        return;
      };

      const hookSpy = sandbox.spy(beforeRequestAdsHook);

      adTag.beforeRequestAds(hookSpy);
      adTag.configure({ slots: [], consent: consentConfig, logger: noopLogger });
      return adTag.requestAds().then(() => {
        expect(hookSpy).to.be.calledOnce;
      });
    });
  });

  describe('environment override', () => {
    it('should override the environment with test', () => {
      const adTag = createMoliTag(dom.window);

      dom.reconfigure({
        url: 'https://localhost?moliEnv=test'
      });

      adTag.configure({ slots: [], consent: consentConfig });

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.reporting).to.be.ok;
      expect(config!.environment).to.be.equal('test');
    });

    it('should override the environment with production', () => {
      const adTag = createMoliTag(dom.window);

      dom.reconfigure({
        url: 'https://localhost?moliEnv=production'
      });

      adTag.configure({ slots: [], consent: consentConfig });

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.reporting).to.be.ok;
      expect(config!.environment).to.be.equal('production');
    });

    it('should not change the environment if query parameter is invalid', () => {
      const adTag = createMoliTag(dom.window);

      dom.reconfigure({
        url: 'https://localhost?moliEnv=wrong'
      });

      adTag.configure({ slots: [], consent: consentConfig });

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.reporting).to.be.ok;
      expect(config!.environment).to.be.undefined;
    });
  });

  describe('multiple configurations', () => {
    it('should not miss any configuration', () => {
      const adTag = createMoliTag(dom.window);
      adTag.setTargeting('pre', 'configure1');
      adTag.addLabel('pre');
      adTag.configure({
        slots: [], consent: consentConfig, targeting: {
          keyValues: {
            pre: 'dismiss',
            post: 'dismiss',
            persists: 'available'
          },
          labels: [ 'pre-existing' ]
        }
      });
      adTag.addLabel('post');
      adTag.setTargeting('post', 'configure2');
      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.targeting).to.be.ok;
      expect(config!.targeting!.labels).to.be.deep.equals([ 'pre-existing', 'pre', 'post' ]);
      expect(config!.targeting!.keyValues).to.be.deep.equals({
        pre: 'configure1',
        post: 'configure2',
        persists: 'available'
      });
    });
  });
});
// tslint:enable
