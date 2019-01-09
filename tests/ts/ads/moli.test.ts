import '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { Moli } from '../../../source/ts/types/moli';
import { createMoliTag, moli } from '../../../source/ts/ads/moliGlobal';
import { googletagStub } from '../stubs/googletagStubs';
import { pbjsStub } from '../stubs/prebidjsStubs';
import { consentConfig, noopLogger } from '../stubs/moliStubs';
import IConfigurable = Moli.state.IConfigurable;

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('moli', () => {

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  beforeEach(() => {
    window.googletag = googletagStub;
    window.pbjs = pbjsStub;
  });

  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });

  afterEach(() => {
    sandbox.reset();
  });



  it('should set the window.moli tag', () => {
    expect(window.moli).to.be.ok;
    expect(window.moli).to.be.equal(moli);
  });

  describe('state machine', () => {

    it('should start in configurable state', () => {
      const adTag = createMoliTag();
      expect(adTag.getState()).to.be.eq('configurable');
    });

    it('should stay in configurable state after setTargeting()', () => {
      const adTag = createMoliTag();
      adTag.setTargeting('key', 'value');
      expect(adTag.getState()).to.be.eq('configurable');
    });

    it('should transition into configured state after configure()', () => {
      const adTag = createMoliTag();
      adTag.configure({ slots: [], consent: consentConfig });
      expect(adTag.getState()).to.be.eq('configured');
    });

    it('should stay in configured state after setTargeting()', () => {
      const adTag = createMoliTag();
      adTag.configure({ slots: [], consent: consentConfig });
      adTag.setTargeting('key', 'value');
      expect(adTag.getState()).to.be.eq('configured');
    });

    it('should transition into requestAds state after requestAds()', () => {
      const adTag = createMoliTag();
      adTag.configure({ slots: [], consent: consentConfig, logger: noopLogger });
      const finished = adTag.requestAds();
      expect(adTag.getState()).to.be.eq('requestAds');
      return finished.then(state => {
        expect(state.state).to.be.eq('finished');
      });
    });

    it('should stay in configurable state after requestAds() and set initialize to true', () => {
      const adTag = createMoliTag();
      const finished = adTag.requestAds();
      expect(adTag.getState()).to.be.eq('configurable');
      return finished.then(state => {
        expect(state.state).to.be.eq('configurable');
        const configurableState: IConfigurable = state as IConfigurable;
        expect(configurableState.initialize).to.be.true;
      });
    });
  });

  describe('setTargeting()', () => {

    it('should add key-values to the config', () => {
      const adTag = createMoliTag();
      adTag.setTargeting('pre', 'configure1');
      adTag.configure({ slots: [], consent: consentConfig });
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
      const adTag = createMoliTag();
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
  });

  describe('addLabel()', () => {

    it('should add label to the config', () => {
      const adTag = createMoliTag();
      adTag.addLabel('pre');
      adTag.configure({ slots: [], consent: consentConfig });
      adTag.addLabel('post');

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.targeting).to.be.ok;
      expect(config!.targeting!.labels).to.be.deep.equals([ 'pre', 'post' ]);
    });

    it('should append to preexisting values', () => {
      const adTag = createMoliTag();
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
      const adTag = createMoliTag();
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
      const adTag = createMoliTag();

      adTag.setSampleRate(0.23);
      adTag.configure({ slots: [], consent: consentConfig });

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.reporting).to.be.ok;
      expect(config!.reporting!.sampleRate).to.be.equal(0.23);
    });

    it('should set the given sample rate instance after configure() is called', () => {
      const adTag = createMoliTag();

      adTag.configure({ slots: [], consent: consentConfig });
      adTag.setSampleRate(0.23);

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.reporting).to.be.ok;
      expect(config!.reporting!.sampleRate).to.be.equal(0.23);
    });

    it('should set the reporters array to an empty array', () => {
      const adTag = createMoliTag();

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
      const adTag = createMoliTag();

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
      const adTag = createMoliTag();

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
      const adTag = createMoliTag();

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

  describe('multiple configurations', () => {
    it('should not miss any configuration', () => {
      const adTag = createMoliTag();
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
