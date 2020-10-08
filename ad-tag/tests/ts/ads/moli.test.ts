import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { Moli } from '../../../source/ts/types/moli';
import { createMoliTag } from '../../../source/ts/ads/moli';
import { initAdTag } from '../../../source/ts/ads/moliGlobal';
import { createGoogletagStub } from '../stubs/googletagStubs';
import { pbjsStub } from '../stubs/prebidjsStubs';
import { emptyConfig, newEmptyConfig, noopLogger } from '../stubs/moliStubs';
import IConfigurable = Moli.state.IConfigurable;
import IFinished = Moli.state.IFinished;
import ISinglePageApp = Moli.state.ISinglePageApp;
import { IModule } from '../../../source/ts/types/module';
import { IAssetLoaderService } from '../../../source/ts/util/assetLoaderService';

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('moli', () => {
  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const dom = createDom();
  dom.window.pbjs = pbjsStub;

  let domIdCounter: number = 0;
  const mkAdSlotInDOM = (): Moli.AdSlot => {
    domIdCounter = domIdCounter + 1;
    const domId = `dom-id-${domIdCounter}`;
    const adDiv = dom.window.document.createElement('div');
    adDiv.id = domId;
    dom.window.document.body.appendChild(adDiv);
    return {
      domId: domId,
      adUnitPath: `/123/ad-unit-${domIdCounter}`,
      sizes: [],
      position: 'in-page',
      sizeConfig: [],
      behaviour: { loaded: 'eager' }
    };
  };

  const defaultSlots: Moli.AdSlot[] = [mkAdSlotInDOM()];
  const defaultConfig: Moli.MoliConfig = {
    ...emptyConfig,
    slots: defaultSlots
  };

  beforeEach(() => {
    dom.window.googletag = createGoogletagStub();
  });

  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('init ad tag', () => {
    it('should initialize the global moli variable', () => {
      const moliWindow = (dom.window as unknown) as Moli.MoliWindow;
      expect(moliWindow.moli).to.be.undefined;
      const moli = initAdTag(moliWindow);
      expect(moliWindow.moli).to.be.equal(moli);
    });

    it('should process the global command queue', () => {
      const moliWindow = (dom.window as unknown) as Moli.MoliWindow;
      const cmd1Spy = sandbox.spy();
      const cmd2Spy = sandbox.spy();
      moliWindow.moli = { que: [cmd1Spy, cmd2Spy] } as any;
      const moli = initAdTag(moliWindow);
      expect(cmd1Spy).to.have.been.calledOnceWithExactly(moli);
      expect(cmd2Spy).to.have.been.calledOnceWithExactly(moli);
    });
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
      adTag.configure(defaultConfig);
      expect(adTag.getState()).to.be.eq('configured');
    });

    it('should stay in configured state after setTargeting()', () => {
      const adTag = createMoliTag(dom.window);
      adTag.configure(defaultConfig);
      adTag.setTargeting('key', 'value');
      expect(adTag.getState()).to.be.eq('configured');
    });

    it('should transition into requestAds state after requestAds()', () => {
      const adTag = createMoliTag(dom.window);
      adTag.configure(defaultConfig);
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
      dom.reconfigure({
        url: 'https://localhost/page-one'
      });
      const adTag = createMoliTag(dom.window);
      adTag.enableSinglePageApp();
      adTag.configure(defaultConfig);
      expect(adTag.getState()).to.be.eq('configured');
      return adTag
        .requestAds()
        .then(state => {
          expect(state.state).to.be.eq('spa-finished');
          const spaState: ISinglePageApp = state as ISinglePageApp;
          expect(spaState.config).to.be.ok;
          dom.reconfigure({
            url: 'https://localhost/page-two'
          });
          return adTag.requestAds();
        })
        .then(state => {
          expect(state.state).to.be.eq('spa-finished');
          const spaState: ISinglePageApp = state as ISinglePageApp;
          expect(spaState.config).to.be.ok;
        });
    });

    it('should fail in spa state if single page app is enabled and requestAds is called multiple times without changing the window.location.href', () => {
      dom.reconfigure({
        url: 'https://localhost/page-one'
      });
      const adTag = createMoliTag(dom.window);
      adTag.enableSinglePageApp();
      adTag.configure(defaultConfig);
      expect(adTag.getState()).to.be.eq('configured');
      return adTag
        .requestAds()
        .then(state => {
          expect(state.state).to.be.eq('spa-finished');
          const spaState: ISinglePageApp = state as ISinglePageApp;
          expect(spaState.config).to.be.ok;
          return adTag.requestAds();
        })
        .then(
          () => {
            expect.fail();
          },
          error => {
            expect(error.toString()).to.be.equal(
              'You are trying to refresh ads on the same page, which is not allowed.'
            );
          }
        );
    });
  });

  describe('registerModule()', () => {
    const fakeModule: IModule = {
      description: '',
      moduleType: 'cmp',
      name: '',
      config(): Object | null {
        return null;
      },
      init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
        return;
      }
    };

    const initSpy = sandbox.spy(fakeModule, 'init');

    it('should init modules in the configure call', () => {
      const adTag = createMoliTag(dom.window);
      const config = newEmptyConfig(defaultSlots);

      adTag.registerModule(fakeModule);
      adTag.configure(config);

      expect(initSpy).to.have.been.calledOnceWithExactly(config, adTag.getAssetLoaderService());
    });

    it('should init modules and use the changed config', () => {
      const adTag = createMoliTag(dom.window);
      const config = newEmptyConfig(defaultSlots);
      const targeting = {
        keyValues: { foo: 'bar' },
        labels: ['module']
      };
      const configChangingModule = {
        ...fakeModule,
        init(config: Moli.MoliConfig): void {
          config.targeting = targeting;
        }
      };
      const configChangingInitSpy = sandbox.spy(configChangingModule, 'init');

      adTag.registerModule(configChangingModule);
      adTag.configure(config);

      expect(configChangingInitSpy).to.have.been.calledOnceWithExactly(
        config,
        adTag.getAssetLoaderService()
      );
      expect(adTag.getState()).to.be.eq('configured');
      const newConfig = adTag.getConfig()!;
      expect(newConfig).to.be.ok;

      expect(newConfig.targeting).to.deep.equals(targeting);
    });

    it('should never register modules if the state is not configurable', () => {
      const adTag = createMoliTag(dom.window);
      const config = newEmptyConfig(defaultSlots);
      const logger = config.logger!;

      const errorLogSpy = sandbox.spy(logger, 'error');

      adTag.configure(config);
      adTag.registerModule(fakeModule);

      expect(initSpy).to.have.not.been.called;
      expect(errorLogSpy).to.have.been.calledOnceWithExactly(
        'Registering a module is only allowed within the ad tag before the ad tag is configured'
      );
    });
  });

  describe('refreshAds()', () => {
    describe('server side application mode', () => {
      it('should batch slots until requestAds is called', () => {
        // create all slots
        const slots: Moli.AdSlot[] = [
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } },
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } }
        ];

        const adTag = createMoliTag(dom.window);

        const refreshSpy = sandbox.spy(dom.window.googletag.pubads(), 'refresh');

        adTag.refreshAdSlot(slots[0].domId);
        adTag.configure({ ...defaultConfig, slots: slots });
        adTag.refreshAdSlot(slots[1].domId);

        expect(adTag.getState()).to.be.eq('configured');
        return adTag.requestAds().then(state => {
          expect(state.state).to.be.eq('finished');
          expect(refreshSpy).to.have.been.calledOnce;
          const domIds = refreshSpy.firstCall.args[0]!.map(slot => slot.getSlotElementId());

          expect(domIds).to.be.deep.eq(slots.map(slot => slot.domId));
        });
      });

      it('should refresh ads after requestAds have been called', () => {
        // create all slots
        const slots: Moli.AdSlot[] = [
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } },
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } }
        ];

        const adTag = createMoliTag(dom.window);

        const refreshSpy = sandbox.spy(dom.window.googletag.pubads(), 'refresh');

        adTag.refreshAdSlot(slots[0].domId);
        adTag.configure({ ...defaultConfig, slots: slots });

        expect(adTag.getState()).to.be.eq('configured');
        return adTag
          .requestAds()
          .then(state => adTag.refreshAdSlot(slots[1].domId).then(() => state))
          .then(state => {
            expect(state.state).to.be.eq('finished');
            const firstCallDomIds = refreshSpy.firstCall.args[0]!.map(slot =>
              slot.getSlotElementId()
            );
            expect(firstCallDomIds).to.have.length(1);

            expect(firstCallDomIds[0]).to.be.eq(slots[0].domId);
            // refreshAds call after requestAds
            const secondCallDomIds = refreshSpy.secondCall.args[0]!.map(slot =>
              slot.getSlotElementId()
            );

            expect(secondCallDomIds).to.have.length(1);
            expect(secondCallDomIds[0]).to.be.eq(slots[1].domId);

            expect(refreshSpy).to.have.been.calledTwice;
          });
      });
    });

    describe('single page application mode (spa)', () => {
      it('should batch refresh calls before requestAds() is called', () => {
        // create all slots
        const slots: Moli.AdSlot[] = [
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } },
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } },
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } }
        ];

        const adTag = createMoliTag(dom.window);

        const refreshSpy = sandbox.spy(dom.window.googletag.pubads(), 'refresh');

        adTag.refreshAdSlot(slots[0].domId);
        adTag.enableSinglePageApp();
        adTag.refreshAdSlot(slots[1].domId);
        adTag.configure({ ...defaultConfig, slots: slots });
        adTag.refreshAdSlot(slots[2].domId);

        expect(adTag.getState()).to.be.eq('configured');
        return adTag.requestAds().then(state => {
          expect(state.state).to.be.eq('spa-finished');
          const spaState: ISinglePageApp = state as ISinglePageApp;
          expect(spaState.config).to.be.ok;
          expect(spaState.refreshSlots).to.be.empty;
          expect(refreshSpy).to.have.been.calledOnce;
          const domIds = refreshSpy.firstCall.args[0]!.map(slot => slot.getSlotElementId());

          expect(domIds).to.be.deep.eq(slots.map(slot => slot.domId));
        });
      });

      it('should call refresh after refreshAds is being called', () => {
        // create all slots
        const slots: Moli.AdSlot[] = [
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } },
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } }
        ];

        const adTag = createMoliTag(dom.window);

        const refreshSpy = sandbox.spy(dom.window.googletag.pubads(), 'refresh');

        adTag.enableSinglePageApp();
        adTag.configure({ ...defaultConfig, slots: slots });
        adTag.refreshAdSlot(slots[0].domId);

        expect(adTag.getState()).to.be.eq('configured');
        return (
          adTag
            .requestAds()
            // refresh after requestAds has been called
            .then(state => adTag.refreshAdSlot(slots[1].domId).then(() => state))
            .then(state => {
              expect(state.state).to.be.eq('spa-finished');
              const spaState: ISinglePageApp = state as ISinglePageApp;
              expect(spaState.config).to.be.ok;
              expect(spaState.refreshSlots).to.be.empty;
              expect(refreshSpy).to.have.been.calledTwice;
              const domIds = refreshSpy.firstCall.args[0]!.map(slot => slot.getSlotElementId());
              expect(domIds).to.have.length(1);
              expect(domIds[0]).to.be.eq(slots[0].domId);
            })
        );
      });

      it('should queue refreshAds calls if a navigation changed happened and no requestAds() call has happend yet', () => {
        dom.reconfigure({
          url: 'https://localhost/page-one'
        });

        // create all slots
        const slots: Moli.AdSlot[] = [{ ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } }];

        const adTag = createMoliTag(dom.window);
        const refreshSpy = sandbox.spy(dom.window.googletag.pubads(), 'refresh');

        adTag.enableSinglePageApp();
        adTag.configure({ ...defaultConfig, slots: slots });

        expect(adTag.getState()).to.be.eq('configured');

        // we must set the state to 'spa-finished' here
        return (
          adTag
            .requestAds()
            .then(state => {
              // navigation change
              dom.reconfigure({
                url: 'https://localhost/page-two'
              });
              return state;
            })
            // refresh after requestAds has been called - this should be queue up
            .then(state => adTag.refreshAdSlot(slots[0].domId).then(() => state))
            .then(state => {
              expect(state.state).to.be.eq('spa-finished');
              const spaState: ISinglePageApp = state as ISinglePageApp;
              expect(spaState.config).to.be.ok;
              expect(spaState.refreshSlots).to.have.length(1);

              expect(refreshSpy).to.have.not.been.called;
              expect(spaState.refreshSlots).to.contain(slots[0].domId);
            })
        );
      });
    });
  });

  describe('setTargeting()', () => {
    it('should add key-values to the config', () => {
      const adTag = createMoliTag(dom.window);
      adTag.setTargeting('pre', 'configure1');
      adTag.configure(defaultConfig);
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
        slots: defaultSlots,
        targeting: {
          keyValues: {
            pre: 'dismiss',
            post: 'dismiss'
          }
        },
        yieldOptimization: {
          provider: 'none'
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
      adTag.configure(defaultConfig);

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

    it('should persists the initial key-values in spa mode for all requestAd() calls', () => {
      const googletagPubAdsSetTargetingSpy = sandbox.spy(
        dom.window.googletag.pubads(),
        'setTargeting'
      );
      dom.reconfigure({
        url: 'https://localhost/1'
      });
      const adTag = createMoliTag(dom.window);
      adTag.enableSinglePageApp();
      adTag.setTargeting('dynamicKeyValuePre', 'value');
      adTag.configure({
        slots: defaultSlots,
        logger: noopLogger,
        targeting: {
          keyValues: { keyFromAdConfig: 'value' },
          labels: []
        },
        yieldOptimization: {
          provider: 'none'
        }
      });
      adTag.setTargeting('dynamicKeyValuePost', 'value');

      expect(adTag.getState()).to.be.eq('configured');
      return adTag
        .requestAds()
        .then(state => {
          expect(state.state).to.be.eq('spa-finished');
          const spaState: ISinglePageApp = state as ISinglePageApp;
          expect(spaState.config).to.be.ok;
          expect(spaState.keyValues).to.be.deep.equal({});
          expect(googletagPubAdsSetTargetingSpy.callCount).to.be.gte(5);
          expect(googletagPubAdsSetTargetingSpy).calledWithExactly('dynamicKeyValuePre', 'value');
          expect(googletagPubAdsSetTargetingSpy).calledWithExactly('dynamicKeyValuePost', 'value');
          expect(googletagPubAdsSetTargetingSpy).calledWithExactly('keyFromAdConfig', 'value');
          expect(googletagPubAdsSetTargetingSpy).calledWithMatch('ABtest', Sinon.match.any);
          googletagPubAdsSetTargetingSpy.resetHistory();
          dom.reconfigure({
            url: 'https://localhost/2'
          });
          // set targeting for next page
          adTag.setTargeting('kv1', 'value');
          adTag.setTargeting('kv2', 'value');

          expect(spaState.keyValues).to.be.deep.equals({
            kv1: 'value',
            kv2: 'value'
          });

          return adTag.requestAds();
        })
        .then(state => {
          expect(state.state).to.be.eq('spa-finished');
          const spaState: ISinglePageApp = state as ISinglePageApp;
          expect(spaState.keyValues).to.be.deep.equal({});
          expect(spaState.config.targeting).to.be.ok;

          const keyValues = spaState.config.targeting!.keyValues;
          expect(keyValues).to.have.all.keys(['ABtest', 'keyFromAdConfig', 'kv1', 'kv2']);
          expect(keyValues).to.have.property('keyFromAdConfig', 'value');
          expect(keyValues).to.have.property('kv1', 'value');
          expect(keyValues).to.have.property('kv2', 'value');

          expect(googletagPubAdsSetTargetingSpy.callCount).to.be.gte(4);
          expect(googletagPubAdsSetTargetingSpy).calledWithExactly('keyFromAdConfig', 'value');
          expect(googletagPubAdsSetTargetingSpy).calledWithExactly('kv1', 'value');
          expect(googletagPubAdsSetTargetingSpy).calledWithExactly('kv2', 'value');
          expect(googletagPubAdsSetTargetingSpy).calledWithMatch('ABtest', Sinon.match.any);
        });
    });
  });

  describe('addLabel()', () => {
    it('should add label to the config', () => {
      const adTag = createMoliTag(dom.window);
      adTag.addLabel('pre');
      adTag.configure(defaultConfig);
      adTag.addLabel('post');

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.targeting).to.be.ok;
      expect(config!.targeting!.labels).to.be.deep.equals(['pre', 'post']);
    });

    it('should append to preexisting values', () => {
      const adTag = createMoliTag(dom.window);
      adTag.addLabel('pre');
      adTag.configure({
        slots: defaultSlots,
        targeting: {
          keyValues: {},
          labels: ['pre-existing']
        },
        yieldOptimization: {
          provider: 'none'
        }
      });
      adTag.addLabel('post');

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.targeting).to.be.ok;
      expect(config!.targeting!.labels).to.be.deep.equals(['pre-existing', 'pre', 'post']);
    });

    it('should persists the initial labels in spa mode for all requestAd() calls', () => {
      dom.reconfigure({
        url: 'https://localhost/1'
      });
      const adTag = createMoliTag(dom.window);
      adTag.enableSinglePageApp();
      adTag.addLabel('dynamicLabelPre');
      adTag.configure({
        slots: defaultSlots,
        logger: noopLogger,
        targeting: {
          keyValues: {},
          labels: ['a9']
        },
        yieldOptimization: {
          provider: 'none'
        }
      });
      adTag.addLabel('dynamicLabelPost');

      expect(adTag.getState()).to.be.eq('configured');
      expect(adTag.getConfig()!.targeting!.labels).to.contain.all.members([
        'dynamicLabelPre',
        'dynamicLabelPost',
        'a9'
      ]);
      return adTag
        .requestAds()
        .then(state => {
          expect(state.state).to.be.eq('spa-finished');
          const spaState: ISinglePageApp = state as ISinglePageApp;
          expect(spaState.config).to.be.ok;
          expect(spaState.labels).to.be.empty;
          dom.reconfigure({
            url: 'https://localhost/2'
          });
          // set targeting for next page
          adTag.addLabel('label1');
          adTag.addLabel('label2');

          expect(spaState.labels).to.contain.all.members(['label1', 'label2']);

          return adTag.requestAds();
        })
        .then(state => {
          expect(state.state).to.be.eq('spa-finished');
          const spaState: ISinglePageApp = state as ISinglePageApp;
          expect(spaState.labels).to.be.empty;
          expect(spaState.config.targeting).to.be.ok;
          expect(spaState.config.targeting!.labels).to.contain.all.members([
            'a9',
            'label1',
            'label2'
          ]);
        });
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
      adTag.configure(defaultConfig);

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.logger).to.be.equal(customLogger);
    });
  });

  describe('setSampleRate()', () => {
    it('should set the given sample rate instance before configure() is called', () => {
      const adTag = createMoliTag(dom.window);

      adTag.setSampleRate(0.23);
      adTag.configure(defaultConfig);

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.reporting).to.be.ok;
      expect(config!.reporting!.sampleRate).to.be.equal(0.23);
    });

    it('should set the given sample rate instance after configure() is called', () => {
      const adTag = createMoliTag(dom.window);

      adTag.configure(defaultConfig);
      adTag.setSampleRate(0.23);

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.reporting).to.be.ok;
      expect(config!.reporting!.sampleRate).to.be.equal(0.23);
    });

    it('should set the reporters array to an empty array', () => {
      const adTag = createMoliTag(dom.window);

      adTag.configure(defaultConfig);
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
      adTag.configure(defaultConfig);
      adTag.addReporter(voidReporter);

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.reporting).to.be.ok;
      expect(config!.reporting!.reporters).length(2);
      expect(config!.reporting!.reporters).to.deep.equal([voidReporter, voidReporter]);
    });

    it('should set the default sampleRate to 0', () => {
      const adTag = createMoliTag(dom.window);

      const voidReporter: Moli.reporting.Reporter = () => {
        return;
      };
      adTag.addReporter(voidReporter);
      adTag.configure(defaultConfig);

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
      adTag.configure(defaultConfig);
      return adTag.requestAds().then(() => {
        expect(hookSpy).to.be.calledOnce;
      });
    });

    it('should add the afterRequestAds hook if requestAds() was successful', () => {
      const adTag = createMoliTag(dom.window);

      const afterRequestAdsHook = (_: Moli.state.AfterRequestAdsStates) => {
        return;
      };

      const hookSpy = sandbox.spy(afterRequestAdsHook);

      adTag.afterRequestAds(hookSpy);
      adTag.configure(defaultConfig);
      return adTag.requestAds().then(() => {
        expect(hookSpy).to.be.calledOnce;
        expect(hookSpy).to.be.calledOnceWithExactly('finished');
      });
    });

    it('should add the afterRequestAds hook with spa state if requestAds() was successful', () => {
      const adTag = createMoliTag(dom.window);

      const afterRequestAdsHook = (_: Moli.state.AfterRequestAdsStates) => {
        return;
      };

      const hookSpy = sandbox.spy(afterRequestAdsHook);

      adTag.afterRequestAds(hookSpy);
      adTag.enableSinglePageApp();
      adTag.configure(defaultConfig);
      return adTag.requestAds().then(() => {
        expect(hookSpy).to.be.calledOnce;
        expect(hookSpy).to.be.calledOnceWithExactly('spa-finished');
      });
    });

    it('should call the afterRequestAds hook with finished state on each requestAds() call', () => {
      const adTag = createMoliTag(dom.window);
      dom.reconfigure({
        url: 'https://localhost/'
      });

      const afterRequestAdsHook = (_: Moli.state.AfterRequestAdsStates) => {
        return;
      };

      const hookSpy = sandbox.spy(afterRequestAdsHook);

      adTag.afterRequestAds(hookSpy);
      adTag.enableSinglePageApp();
      adTag.configure(defaultConfig);
      return adTag
        .requestAds()
        .then(() => {
          expect(hookSpy).to.be.calledOnce;
          expect(hookSpy).to.be.calledOnceWithExactly('spa-finished');
          dom.reconfigure({
            url: 'https://localhost/home'
          });
          return adTag.requestAds();
        })
        .then(() => {
          expect(hookSpy).to.be.calledTwice;
          expect(hookSpy.secondCall.args[0]).to.be.equal('spa-finished');
        });
    });

    it('should add the afterRequestAds hook with error state if requestAds() failed', () => {
      dom.window.googletag = {
        ...createGoogletagStub(),
        cmd: {
          push(_: Function): void {
            throw Error('trigger an error!');
          }
        }
      };
      const adTag = createMoliTag(dom.window);

      const afterRequestAdsHook = (_: Moli.state.AfterRequestAdsStates) => {
        return;
      };

      const hookSpy = sandbox.spy(afterRequestAdsHook);

      adTag.afterRequestAds(hookSpy);
      adTag.configure(defaultConfig);
      return adTag.requestAds().then(() => {
        expect(hookSpy).to.be.calledOnce;
        expect(hookSpy).to.be.calledOnceWithExactly('error');
      });
    });
  });

  describe('environment override', () => {
    it('should override the environment with test', () => {
      const adTag = createMoliTag(dom.window);

      dom.reconfigure({
        url: 'https://localhost?moliEnv=test'
      });

      adTag.configure(defaultConfig);

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

      adTag.configure(defaultConfig);

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

      adTag.configure(defaultConfig);

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
        slots: defaultSlots,
        targeting: {
          keyValues: {
            pre: 'dismiss',
            post: 'dismiss',
            persists: 'available'
          },
          labels: ['pre-existing']
        },
        yieldOptimization: {
          provider: 'none'
        }
      });
      adTag.addLabel('post');
      adTag.setTargeting('post', 'configure2');
      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.targeting).to.be.ok;
      expect(config!.targeting!.labels).to.be.deep.equals(['pre-existing', 'pre', 'post']);
      expect(config!.targeting!.keyValues).to.be.deep.equals({
        pre: 'configure1',
        post: 'configure2',
        persists: 'available'
      });
    });
  });
});
// tslint:enable
