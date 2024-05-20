import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { MoliRuntime } from '../types/moliRuntime';
import { createMoliTag } from './moli';
import { initAdTag } from './moliGlobal';
import { createGoogletagStub } from '../stubs/googletagStubs';
import { pbjsStub } from '../stubs/prebidjsStubs';
import { emptyConfig, newEmptyConfig } from '../stubs/moliStubs';
import IConfigurable = MoliRuntime.state.IConfigurable;
import IFinished = MoliRuntime.state.IFinished;
import ISinglePageApp = MoliRuntime.state.ISinglePageApp;
import { IModule } from '../types/module';
import { IAssetLoaderService } from '../util/assetLoaderService';
import { tcData, tcfapiFunction } from '../stubs/consentStubs';
import { googletag } from '../types/googletag';
import { prebidjs } from '../types/prebidjs';
import { BrowserStorageKeys } from '../util/browserStorageKeys';
import { JSDOM } from 'jsdom';
import { dummySupplyChainNode } from '../stubs/schainStubs';
import { AdSlot, Environment, MoliConfig, SinglePageAppConfig } from '../types/moliConfig';
import MoliTag = MoliRuntime.MoliTag;
import state = MoliRuntime.state;
import { ConfigureStep, InitStep, PrepareRequestAdsStep } from './adPipeline';

// setup sinon-chai
use(sinonChai);

describe('moli', () => {
  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  let dom: JSDOM;
  let jsDomWindow: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow;
  let domIdCounter: number;
  let mkAdSlotInDOM: () => AdSlot;
  let defaultSlots: AdSlot[];
  let defaultConfig: MoliConfig;

  beforeEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    jsDomWindow.pbjs = pbjsStub;
    domIdCounter = 0;

    mkAdSlotInDOM = () => {
      domIdCounter = domIdCounter + 1;
      const domId = `dom-id-${domIdCounter}`;
      const adDiv = jsDomWindow.document.createElement('div');
      adDiv.id = domId;
      jsDomWindow.document.body.appendChild(adDiv);
      return {
        domId: domId,
        adUnitPath: `/123/ad-unit-${domIdCounter}`,
        sizes: [],
        position: 'in-page',
        sizeConfig: [],
        behaviour: { loaded: 'eager' }
      };
    };

    defaultSlots = [mkAdSlotInDOM()];
    defaultConfig = {
      ...emptyConfig,
      slots: defaultSlots
    };

    dom.window.googletag = createGoogletagStub();
    dom.window.__tcfapi = tcfapiFunction(tcData);
    sandbox.stub(dom.window.document, 'readyState').get(() => 'complete');
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
      const moliWindow = jsDomWindow as unknown as MoliRuntime.MoliWindow;
      expect(moliWindow.moli).to.be.undefined;
      const moli = initAdTag(moliWindow);
      expect(moliWindow.moli).to.be.equal(moli);
    });

    it('should process the global command queue', () => {
      const moliWindow = jsDomWindow as unknown as MoliRuntime.MoliWindow;
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
      const adTag = createMoliTag(jsDomWindow);
      expect(adTag.getState()).to.be.eq('configurable');
    });

    it('should stay in configurable state after setTargeting()', () => {
      const adTag = createMoliTag(jsDomWindow);
      adTag.setTargeting('key', 'value');
      expect(adTag.getState()).to.be.eq('configurable');
    });

    it('should transition into configured state after configure()', () => {
      const adTag = createMoliTag(jsDomWindow);
      adTag.configure(defaultConfig);
      expect(adTag.getState()).to.be.eq('configured');
    });

    it('should stay in configured state after setTargeting()', () => {
      const adTag = createMoliTag(jsDomWindow);
      adTag.configure(defaultConfig);
      adTag.setTargeting('key', 'value');
      expect(adTag.getState()).to.be.eq('configured');
    });

    it('should transition into requestAds state after requestAds()', () => {
      const adTag = createMoliTag(jsDomWindow);
      adTag.configure(defaultConfig);
      const finished = adTag.requestAds();
      expect(adTag.getState()).to.be.eq('requestAds');
      return finished.then(state => {
        expect(state.state).to.be.eq('finished');
      });
    });

    it('should stay in configurable state after requestAds() and set initialize to true', () => {
      const adTag = createMoliTag(jsDomWindow);
      const finished = adTag.requestAds();
      expect(adTag.getState()).to.be.eq('configurable');
      return finished.then(state => {
        expect(state.state).to.be.eq('configurable');
        const configurableState: IConfigurable = state as IConfigurable;
        expect(configurableState.initialize).to.be.true;
      });
    });

    it('should stay in spa state if single page app is enabled and requestAds is called multiple times', async () => {
      dom.reconfigure({
        url: 'https://localhost/page-one'
      });
      const adTag = createMoliTag(jsDomWindow);
      adTag.configure({ ...defaultConfig, spa: { enabled: true, validateLocation: 'href' } });
      expect(adTag.getState()).to.be.eq('configured');
      const state1 = await adTag.requestAds();
      expect(state1.state).to.be.eq('spa-finished');
      const spaState1: ISinglePageApp = state1 as ISinglePageApp;
      expect(spaState1.config).to.be.ok;
      dom.reconfigure({
        url: 'https://localhost/page-two'
      });
      let state2 = await adTag.requestAds();
      expect(state2.state).to.be.eq('spa-finished');
      const spaState2: ISinglePageApp = state2 as ISinglePageApp;
      expect(spaState2.config).to.be.ok;
    });

    it('should stay in spa state if single page app is enabled and requestAds is called multiple times with validationLocation none', async () => {
      dom.reconfigure({
        url: 'https://localhost/page-one'
      });
      const adTag = createMoliTag(jsDomWindow);
      adTag.configure({ ...defaultConfig, spa: { enabled: true, validateLocation: 'none' } });
      expect(adTag.getState()).to.be.eq('configured');
      const state1 = await adTag.requestAds();
      expect(state1.state).to.be.eq('spa-finished');
      const spaState1: ISinglePageApp = state1 as ISinglePageApp;
      expect(spaState1.config).to.be.ok;
      let state2 = await adTag.requestAds();
      expect(state2.state).to.be.eq('spa-finished');
      const spaState2: ISinglePageApp = state2 as ISinglePageApp;
      expect(spaState2.config).to.be.ok;
    });

    it('should fail in spa state if single page app is enabled and requestAds is called multiple times without changing the window.location.href', () => {
      dom.reconfigure({
        url: 'https://localhost/page-one'
      });
      const adTag = createMoliTag(jsDomWindow);
      adTag.configure({ ...defaultConfig, spa: { enabled: true, validateLocation: 'href' } });
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
              'You are trying to refresh ads on the same page, which is not allowed. Using href for validation.'
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
      config(): Object | undefined {
        return undefined;
      },
      init(config: MoliConfig, assetLoaderService: IAssetLoaderService): void {
        return;
      },
      initSteps(assetLoaderService: IAssetLoaderService): InitStep[] {
        return [];
      },
      configureSteps(): ConfigureStep[] {
        return [];
      },
      prepareRequestAdsSteps(): PrepareRequestAdsStep[] {
        return [];
      }
    };

    const initSpy = sandbox.spy(fakeModule, 'init');

    it('should init modules in the requestAds call', async () => {
      const adTag = createMoliTag(jsDomWindow);
      const config = newEmptyConfig(defaultSlots);

      adTag.registerModule(fakeModule);
      adTag.configure(config);
      await adTag.requestAds();

      expect(initSpy).to.have.been.calledOnce;
      expect(initSpy).to.have.been.calledWithMatch(config, adTag.getAssetLoaderService());
    });

    it('should init modules and use the changed config', async () => {
      const adTag = createMoliTag(jsDomWindow);
      const config = newEmptyConfig(defaultSlots);
      const targeting = {
        keyValues: { foo: 'bar' },
        labels: ['module'],
        adUnitPathVariables: {}
      };
      const configChangingModule = {
        ...fakeModule,
        init(config: MoliConfig): void {
          config.targeting = targeting;
        }
      };
      const configChangingInitSpy = sandbox.spy(configChangingModule, 'init');

      adTag.registerModule(configChangingModule);
      adTag.configure(config);
      const state = await adTag.requestAds();

      expect(configChangingInitSpy).to.have.been.calledOnce;
      expect(configChangingInitSpy).to.have.been.calledWithMatch(
        config,
        adTag.getAssetLoaderService()
      );
      expect(adTag.getState()).to.be.eq(state.state);
      const newConfig = adTag.getConfig()!;
      expect(newConfig).to.be.ok;

      expect(newConfig.targeting).to.deep.equals(targeting);
    });

    it('should never register modules if the state is not configurable', () => {
      const adTag = createMoliTag(jsDomWindow);
      const config = newEmptyConfig(defaultSlots);
      const logger = adTag.getRuntimeConfig().logger!;

      const errorLogSpy = sandbox.spy(logger, 'error');

      adTag.configure(config);
      adTag.registerModule(fakeModule);

      expect(initSpy).to.have.not.been.called;
      expect(errorLogSpy).to.have.been.calledOnceWithExactly(
        'Registering a module is only allowed within the ad tag before the ad tag is configured'
      );
    });
  });

  describe('refreshBucket()', () => {
    it('should refresh slots that belong to the same bucket', async () => {
      const slots: AdSlot[] = [
        { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual', bucket: 'one' } },
        { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual', bucket: 'two' } },
        { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual', bucket: 'one' } }
      ];
      const adTag = createMoliTag(jsDomWindow);
      const refreshSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'refresh');

      adTag.configure({
        ...defaultConfig,
        slots: slots
      });

      await adTag.refreshBucket('one');
      await adTag.requestAds();
      // refresh after requestAds has been called
      expect(adTag.getState()).to.be.eq('finished');
      expect(refreshSpy).to.have.been.calledOnce;
      const domIds = (refreshSpy.firstCall.args[0] || []).map(slot => slot.getSlotElementId());
      expect(domIds).to.have.length(2);
      expect(domIds[0]).to.be.eq(slots[0].domId);
      expect(domIds[1]).to.be.eq(slots[2].domId);
    });

    it("should refresh no slots when the bucket doesn't exist", async () => {
      const slots: AdSlot[] = [
        { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual', bucket: 'one' } }
      ];
      const adTag = createMoliTag(jsDomWindow);
      const refreshSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'refresh');

      adTag.configure({
        ...defaultConfig,
        slots: slots
      });

      await adTag.refreshBucket('two');
      await adTag.requestAds();
      // refresh after requestAds has been called
      expect(adTag.getState()).to.be.eq('finished');
      expect(refreshSpy).to.have.not.been.called;
    });
  });

  describe('refreshAds()', () => {
    describe('server side application mode', () => {
      it('should batch slots until requestAds is called', () => {
        // create all slots
        const slots: AdSlot[] = [
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } },
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } }
        ];

        const adTag = createMoliTag(jsDomWindow);

        const refreshSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'refresh');

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
        const slots: AdSlot[] = [
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } },
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } }
        ];

        const adTag = createMoliTag(jsDomWindow);

        const refreshSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'refresh');

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
      const spa: SinglePageAppConfig = { enabled: true, validateLocation: 'href' };

      it('should batch refresh calls before requestAds() is called', async () => {
        // create all slots
        const slots: AdSlot[] = [
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } },
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } },
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } }
        ];

        const adTag = createMoliTag(jsDomWindow);

        const refreshSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'refresh');

        adTag.refreshAdSlot(slots[0].domId);
        adTag.refreshAdSlot(slots[1].domId);
        adTag.configure({ ...defaultConfig, slots: slots, spa: spa });
        adTag.refreshAdSlot(slots[2].domId);

        expect(adTag.getState()).to.be.eq('configured');
        const state = await adTag.requestAds();
        expect(state.state).to.be.eq('spa-finished');
        const spaState: ISinglePageApp = state as ISinglePageApp;
        expect(spaState.config).to.be.ok;
        expect(spaState.runtimeConfig.refreshSlots).to.be.empty;
        expect(refreshSpy).to.have.been.calledOnce;
        const domIds = refreshSpy.firstCall.args[0]!.map(slot => slot.getSlotElementId());
        expect(domIds).to.be.deep.eq(slots.map(slot => slot.domId));
      });

      it('should call refresh after refreshAds is being called', async () => {
        // create all slots
        const slots: AdSlot[] = [
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } },
          { ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } }
        ];

        const adTag = createMoliTag(jsDomWindow);

        const refreshSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'refresh');

        adTag.configure({ ...defaultConfig, slots: slots, spa: spa });
        const refreshAdSlotResponse = await adTag.refreshAdSlot(slots[0].domId);

        expect(adTag.getState()).to.be.eq('configured');
        const requestAdsState = await adTag.requestAds();

        const refreshAdSlotResponse2 = await adTag.refreshAdSlot(slots[1].domId);

        expect(requestAdsState.state).to.be.eq('spa-finished');
        const spaState: ISinglePageApp = requestAdsState as ISinglePageApp;
        expect(spaState.config).to.be.ok;
        expect(spaState.runtimeConfig.refreshSlots).to.be.empty;
        expect(refreshSpy).to.have.been.calledTwice;
        const domIds = refreshSpy.firstCall.args[0]!.map(slot => slot.getSlotElementId());
        expect(domIds).to.have.length(1);
        expect(domIds[0]).to.be.eq(slots[0].domId);
      });

      it('should queue refreshAds calls if a navigation changed happened and no requestAds() call has happend yet', async () => {
        dom.reconfigure({
          url: 'https://localhost/page-one'
        });

        // create all slots
        const slots: AdSlot[] = [{ ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } }];

        const adTag = createMoliTag(jsDomWindow);
        const refreshSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'refresh');

        adTag.configure({ ...defaultConfig, slots: slots, spa: spa });

        expect(adTag.getState()).to.be.eq('configured');

        // we must set the state to 'spa-finished' here
        const requestAdsState = await adTag.requestAds();
        // navigation change
        dom.reconfigure({
          url: 'https://localhost/page-two'
        });
        const refreshAdSlotResponse = await adTag.refreshAdSlot(slots[0].domId);
        expect(refreshAdSlotResponse).to.be.eq('queued');

        expect(requestAdsState.state).to.be.eq('spa-finished');
        const spaState: ISinglePageApp = requestAdsState as ISinglePageApp;
        expect(spaState.config).to.be.ok;
        expect(spaState.runtimeConfig.refreshSlots).to.have.length(1);

        expect(refreshSpy).to.have.not.been.called;
        expect(spaState.runtimeConfig.refreshSlots).to.contain(slots[0].domId);

        // the queue calls should now be executed
        await adTag.requestAds();
        expect(refreshSpy).to.have.been.calledOnce;
      });

      it('should call refreshAds calls if a navigation changed happened and no requestAds() call has happend yet, but validationLocation is set to path', async () => {
        dom.reconfigure({
          url: 'https://localhost/page-one'
        });

        // create all slots
        const slots: AdSlot[] = [{ ...mkAdSlotInDOM(), behaviour: { loaded: 'manual' } }];

        const adTag = createMoliTag(jsDomWindow);
        const refreshSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'refresh');

        adTag.configure({ ...defaultConfig, slots: slots, spa: spa });

        expect(adTag.getState()).to.be.eq('configured');

        // we must set the state to 'spa-finished' here
        const requestAdsState = await adTag.requestAds();
        // navigation change
        dom.reconfigure({
          url: 'https://localhost/page-one?filter=1'
        });
        const refreshAdSlotResponse = await adTag.refreshAdSlot(slots[0].domId);
        expect(refreshAdSlotResponse).to.be.eq('refreshed');

        expect(requestAdsState.state).to.be.eq('spa-finished');
        const spaState: ISinglePageApp = requestAdsState as ISinglePageApp;
        expect(spaState.config).to.be.ok;
        expect(spaState.runtimeConfig.refreshSlots).to.have.length(0);

        expect(refreshSpy).to.have.been.calledOnce;
      });
    });
  });

  describe('setAdUnitPathVariables', () => {
    it('should add adUnitPath variables to the config', () => {
      const adTag = createMoliTag(jsDomWindow);
      adTag.setAdUnitPathVariables({ foo: 'value' });
      adTag.configure(defaultConfig);
      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.targeting).to.be.ok;
      expect(config!.targeting!.adUnitPathVariables).to.be.deep.equals({
        foo: 'value'
      });
    });

    it('should override preexisting adUnitPath variables', () => {
      const adTag = createMoliTag(jsDomWindow);
      adTag.setAdUnitPathVariables({ foo: 'value' });
      adTag.configure({
        slots: defaultSlots,
        targeting: {
          adUnitPathVariables: { pre: 'dismiss' },
          keyValues: {}
        },
        schain: {
          supplyChainStartNode: dummySupplyChainNode
        }
      });
      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.targeting).to.be.ok;
      expect(config!.targeting!.adUnitPathVariables).to.be.deep.equals({
        foo: 'value'
      });
    });

    it('should persists the variables in spa mode for all requestAd() calls', () => {
      dom.reconfigure({
        url: 'https://localhost/1'
      });
      const adTag = createMoliTag(jsDomWindow);
      adTag.setAdUnitPathVariables({ foo: 'value' });
      adTag.configure({
        slots: defaultSlots,
        spa: { enabled: true, validateLocation: 'href' },
        targeting: {
          keyValues: {},
          adUnitPathVariables: {}
        },
        schain: {
          supplyChainStartNode: dummySupplyChainNode
        }
      });
      expect(adTag.getState()).to.be.eq('configured');
      expect(adTag.getConfig()!.targeting!.adUnitPathVariables).to.be.deep.equals({
        foo: 'value'
      });
      return adTag
        .requestAds()
        .then(state => {
          expect(state.state).to.be.eq('spa-finished');
          const spaState: ISinglePageApp = state as ISinglePageApp;
          expect(spaState.config).to.be.ok;
          expect(spaState.runtimeConfig.adUnitPathVariables).to.be.empty;
          dom.reconfigure({
            url: 'https://localhost/2'
          });
          // set targeting for next page
          adTag.setAdUnitPathVariables({ foo: 'value', bar: 'value2' });

          expect(spaState.runtimeConfig.adUnitPathVariables).to.be.deep.equals({
            foo: 'value',
            bar: 'value2'
          });

          return adTag.requestAds();
        })
        .then(state => {
          expect(state.state).to.be.eq('spa-finished');
          const spaState: ISinglePageApp = state as ISinglePageApp;
          expect(spaState.runtimeConfig.adUnitPathVariables).to.be.empty;
          expect(spaState.config.targeting).to.be.ok;
          expect(spaState.config.targeting!.adUnitPathVariables).to.be.deep.equals({
            foo: 'value',
            bar: 'value2'
          });
        });
    });
  });
  describe('resolveAdUnitPath', () => {
    describe('configure state', () => {
      it('should resolve without variables being set', () => {
        const adTag = createMoliTag(jsDomWindow);
        expect(adTag.resolveAdUnitPath('/foo/bar')).to.be.equals('/foo/bar');
      });
      it('should resolve with variables being set', () => {
        const adTag = createMoliTag(jsDomWindow);
        adTag.setAdUnitPathVariables({ foo: 'value' });
        expect(adTag.resolveAdUnitPath('/foo/{foo}')).to.be.equals('/foo/value');
      });
      it('should throw an error when using undefined variables', () => {
        const adTag = createMoliTag(jsDomWindow);
        expect(() => adTag.resolveAdUnitPath('/foo/{foo}')).to.throw(
          Error,
          'path variable "foo" is not defined'
        );
      });
    });

    describe('all other states', () => {
      it('should resolve from the config.targeting.adUnitPathVariables', () => {
        const adTag = createMoliTag(jsDomWindow);
        adTag.setAdUnitPathVariables({ foo: 'value' });
        adTag.configure(defaultConfig);

        expect(adTag.resolveAdUnitPath('/foo/{foo}')).to.be.equals('/foo/value');
      });
    });
  });

  describe('setTargeting()', () => {
    it('should add key-values to the config', () => {
      const adTag = createMoliTag(jsDomWindow);
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
      const adTag = createMoliTag(jsDomWindow);
      adTag.setTargeting('pre', 'configure1');
      adTag.configure({
        slots: defaultSlots,
        targeting: {
          keyValues: {
            pre: 'dismiss',
            post: 'dismiss'
          }
        },
        schain: {
          supplyChainStartNode: dummySupplyChainNode
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

    it('should add ABtest key-value between 1 and 100 in configured state calling requestAds() ', () => {
      const adTag = createMoliTag(jsDomWindow);
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

    it('should persists the initial key-values in spa mode for all requestAd() calls', async () => {
      const googletagPubAdsSetTargetingSpy = sandbox.spy(
        jsDomWindow.googletag.pubads(),
        'setTargeting'
      );
      dom.reconfigure({
        url: 'https://localhost/1'
      });
      const adTag = createMoliTag(jsDomWindow);
      adTag.setTargeting('dynamicKeyValuePre', 'value');
      adTag.configure({
        slots: defaultSlots,
        spa: { enabled: true, validateLocation: 'href' },
        targeting: {
          keyValues: { keyFromAdConfig: 'value' },
          labels: []
        },
        schain: {
          supplyChainStartNode: dummySupplyChainNode
        }
      });
      adTag.setTargeting('dynamicKeyValuePost', 'value');

      expect(adTag.getState()).to.be.eq('configured');
      const state = await adTag.requestAds();
      expect(state.state).to.be.eq('spa-finished');
      const spaState1: ISinglePageApp = state as ISinglePageApp;
      expect(spaState1.config).to.be.ok;
      expect(spaState1.runtimeConfig.keyValues).to.be.deep.equal({});
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

      expect(spaState1.runtimeConfig.keyValues).to.be.deep.equals({
        kv1: 'value',
        kv2: 'value'
      });

      const nextState = await adTag.requestAds();
      expect(nextState.state).to.be.eq('spa-finished');
      const spaState2: ISinglePageApp = nextState as ISinglePageApp;
      expect(spaState2.runtimeConfig.keyValues).to.be.deep.equal({});
      expect(spaState2.config.targeting).to.be.ok;

      const keyValues = spaState2.config.targeting!.keyValues;
      expect(keyValues).to.have.all.keys(['ABtest', 'keyFromAdConfig', 'kv1', 'kv2']);
      expect(keyValues).to.have.property('keyFromAdConfig', 'value');
      expect(keyValues).to.have.property('kv1', 'value');
      expect(keyValues).to.have.property('kv2', 'value');
      expect(keyValues).to.not.have.property('dynamicKeyValuePre', 'value');
      expect(keyValues).to.not.have.property('dynamicKeyValuePost', 'value');

      expect(googletagPubAdsSetTargetingSpy.callCount).to.be.gte(4);
      expect(googletagPubAdsSetTargetingSpy).calledWithExactly('keyFromAdConfig', 'value');
      expect(googletagPubAdsSetTargetingSpy).calledWithExactly('kv1', 'value');
      expect(googletagPubAdsSetTargetingSpy).calledWithExactly('kv2', 'value');
      expect(googletagPubAdsSetTargetingSpy).calledWithMatch('ABtest', Sinon.match.any);
    });
  });

  describe('addLabel()', () => {
    it('should add label to the config', () => {
      const adTag = createMoliTag(jsDomWindow);
      adTag.addLabel('pre');
      adTag.configure(defaultConfig);
      adTag.addLabel('post');

      const config = adTag.getConfig();
      expect(config).to.be.ok;
      expect(config!.targeting).to.be.ok;
      expect(config!.targeting!.labels).to.be.deep.equals(['pre', 'post']);
    });

    it('should append to preexisting values', () => {
      const adTag = createMoliTag(jsDomWindow);
      adTag.addLabel('pre');
      adTag.configure({
        slots: defaultSlots,
        targeting: {
          keyValues: {},
          labels: ['pre-existing']
        },
        schain: {
          supplyChainStartNode: dummySupplyChainNode
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
      const adTag = createMoliTag(jsDomWindow);
      adTag.addLabel('dynamicLabelPre');
      adTag.configure({
        slots: defaultSlots,
        spa: { enabled: true, validateLocation: 'href' },
        targeting: {
          keyValues: {},
          labels: ['a9']
        },
        schain: {
          supplyChainStartNode: dummySupplyChainNode
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
          expect(spaState.runtimeConfig.labels).to.be.empty;
          dom.reconfigure({
            url: 'https://localhost/2'
          });
          // set targeting for next page
          adTag.addLabel('label1');
          adTag.addLabel('label2');

          expect(spaState.runtimeConfig.labels).to.contain.all.members(['label1', 'label2']);

          return adTag.requestAds();
        })
        .then(state => {
          expect(state.state).to.be.eq('spa-finished');
          const spaState: ISinglePageApp = state as ISinglePageApp;
          expect(spaState.runtimeConfig.labels).to.be.empty;
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
      const adTag = createMoliTag(jsDomWindow);
      const customLogger: MoliRuntime.MoliLogger = {
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

      const config = adTag.getRuntimeConfig();
      expect(config).to.be.ok;
      expect(config!.logger).to.be.equal(customLogger);
    });
  });

  describe('hooks', () => {
    it('should add the beforeRequestAds hook and call it', () => {
      const adTag = createMoliTag(jsDomWindow);

      const beforeRequestAdsHook = (_: MoliConfig) => {
        return;
      };

      const hookSpy = sandbox.spy(beforeRequestAdsHook);

      adTag.beforeRequestAds(hookSpy);
      adTag.configure(defaultConfig);
      return adTag.requestAds().then(() => {
        expect(hookSpy).to.be.calledOnce;
      });
    });

    [2, 3].forEach(callCounts => {
      it(`should add ${callCounts} beforeRequestAds hooks and call all`, () => {
        const adTag = createMoliTag(jsDomWindow);

        const beforeRequestAdsHook = (_: MoliConfig) => {
          return;
        };

        const hookSpy = sandbox.spy(beforeRequestAdsHook);

        [...Array.from(new Array(callCounts).keys())].forEach(_ => adTag.beforeRequestAds(hookSpy));
        adTag.configure(defaultConfig);
        return adTag.requestAds().then(() => {
          expect(hookSpy).to.be.callCount(callCounts);
        });
      });
    });

    it('should catch errors in beforeRequestAds hook', async () => {
      const adTag = createMoliTag(jsDomWindow);

      const beforeRequestAdsHook = (_: MoliConfig) => {
        throw new Error('oh no!');
      };

      const hookSpy = sandbox.spy(beforeRequestAdsHook);

      adTag.beforeRequestAds(hookSpy);
      adTag.configure(defaultConfig);
      const result = await adTag.requestAds();
      expect(hookSpy).to.be.calledOnce;
      expect(result.state).not.to.be.eq('error');
    });

    it('should add the beforeRequestAds hook with spa state if requestAds() was successful', async () => {
      const adTag = createMoliTag(jsDomWindow);

      const beforeRequestAdsHook = (_: MoliConfig) => {
        return;
      };

      const hookSpy = sandbox.spy(beforeRequestAdsHook);

      adTag.beforeRequestAds(hookSpy);
      adTag.configure({ ...defaultConfig, spa: { enabled: true, validateLocation: 'href' } });
      await adTag.requestAds();
      expect(hookSpy).to.be.calledOnce;
    });

    it('should add the beforeRequestAds hooks and call them on each requestAds() cal', async () => {
      const adTag = createMoliTag(jsDomWindow);

      const beforeRequestAdsHook = (_: MoliConfig) => {
        return;
      };

      const hookSpy = sandbox.spy(beforeRequestAdsHook);

      adTag.beforeRequestAds(hookSpy);
      adTag.configure({ ...defaultConfig, spa: { enabled: true, validateLocation: 'href' } });
      await adTag.requestAds();
      dom.reconfigure({
        url: 'https://localhost/page-one'
      });
      await adTag.requestAds();
      expect(hookSpy).to.be.calledTwice;
    });

    it('should catch errors in beforeRequestAds hook in spa mode', async () => {
      const adTag = createMoliTag(jsDomWindow);

      const beforeRequestAdsHook = (_: MoliConfig) => {
        throw new Error('oh no!');
      };

      const hookSpy = sandbox.spy(beforeRequestAdsHook);

      adTag.beforeRequestAds(hookSpy);
      adTag.configure({ ...defaultConfig, spa: { enabled: true, validateLocation: 'href' } });
      const result = await adTag.requestAds();
      expect(hookSpy).to.be.calledOnce;
      expect(result.state).not.to.be.eq('error');
    });

    it('should add the afterRequestAds hook if requestAds() was successful', async () => {
      const adTag = createMoliTag(jsDomWindow);

      const afterRequestAdsHook = (_: state.AfterRequestAdsStates) => {
        return;
      };

      const hookSpy = sandbox.spy(afterRequestAdsHook);

      adTag.afterRequestAds(hookSpy);
      adTag.configure(defaultConfig);
      await adTag.requestAds();
      expect(hookSpy).to.be.calledOnce;
      expect(hookSpy).to.be.calledOnceWithExactly('finished');
    });

    [2, 3].forEach(callCounts => {
      it(`should add ${callCounts} afterRequestAds hooks and call all`, () => {
        const adTag = createMoliTag(jsDomWindow);

        const afterRequestAdsHook = (_: state.AfterRequestAdsStates) => {
          return;
        };

        const hookSpy = sandbox.spy(afterRequestAdsHook);

        [...Array.from(new Array(callCounts).keys())].forEach(_ => adTag.afterRequestAds(hookSpy));
        adTag.configure(defaultConfig);
        return adTag.requestAds().then(() => {
          expect(hookSpy).to.be.callCount(callCounts);
          expect(hookSpy).to.be.calledWith('finished');
        });
      });
    });

    it('should add the afterRequestAds hook with spa state if requestAds() was successful', () => {
      const adTag = createMoliTag(jsDomWindow);

      const afterRequestAdsHook = (_: state.AfterRequestAdsStates) => {
        return;
      };

      const hookSpy = sandbox.spy(afterRequestAdsHook);

      adTag.afterRequestAds(hookSpy);
      adTag.configure({ ...defaultConfig, spa: { enabled: true, validateLocation: 'href' } });
      return adTag.requestAds().then(() => {
        expect(hookSpy).to.be.calledOnce;
        expect(hookSpy).to.be.calledOnceWithExactly('spa-finished');
      });
    });

    it('should call the afterRequestAds hook with finished state on each requestAds() call', () => {
      const adTag = createMoliTag(jsDomWindow);
      dom.reconfigure({
        url: 'https://localhost/'
      });

      const afterRequestAdsHook = (_: state.AfterRequestAdsStates) => {
        return;
      };

      const hookSpy = sandbox.spy(afterRequestAdsHook);

      adTag.afterRequestAds(hookSpy);
      adTag.configure({ ...defaultConfig, spa: { enabled: true, validateLocation: 'href' } });
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
      jsDomWindow.googletag = {
        ...createGoogletagStub(),
        pubadsReady: undefined,
        cmd: {
          push(_: Function): void {
            throw Error('trigger an error!');
          }
        }
      };
      const adTag = createMoliTag(jsDomWindow);

      const afterRequestAdsHook = (_: state.AfterRequestAdsStates) => {
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
    const expectEnvironment = (adTag: MoliTag, environment: Environment | undefined) => {
      const config = adTag.getRuntimeConfig();
      expect(config).to.be.ok;
      expect(config!.environment).to.be.equal(environment);
    };

    describe('with query parameter', () => {
      it('should override the environment with test and save that in session storage', () => {
        const adTag = createMoliTag(jsDomWindow);

        dom.reconfigure({
          url: 'https://localhost?moliEnv=test'
        });

        expect(jsDomWindow.sessionStorage.getItem(BrowserStorageKeys.moliEnv)).to.be.null;

        adTag.configure(defaultConfig);

        expectEnvironment(adTag, 'test');
        expect(jsDomWindow.sessionStorage.getItem(BrowserStorageKeys.moliEnv)).to.be.equal('test');
      });

      it('should override the environment with production and save that in session storage', () => {
        const adTag = createMoliTag(jsDomWindow);

        dom.reconfigure({
          url: 'https://localhost?moliEnv=production'
        });

        expect(jsDomWindow.sessionStorage.getItem(BrowserStorageKeys.moliEnv)).to.be.null;

        adTag.configure(defaultConfig);

        expectEnvironment(adTag, 'production');
        expect(jsDomWindow.sessionStorage.getItem(BrowserStorageKeys.moliEnv)).to.be.equal(
          'production'
        );
      });

      it('should not change the environment if query parameter is invalid', () => {
        const adTag = createMoliTag(jsDomWindow);

        dom.reconfigure({
          url: 'https://localhost?moliEnv=wrong'
        });

        adTag.configure(defaultConfig);

        expectEnvironment(adTag, undefined);
      });
    });

    describe('with session storage', () => {
      it('should override the environment with test', () => {
        const adTag = createMoliTag(jsDomWindow);
        jsDomWindow.sessionStorage.setItem(BrowserStorageKeys.moliEnv, 'test');
        adTag.configure(defaultConfig);
        expectEnvironment(adTag, 'test');
      });

      it('should override the environment with production', () => {
        const adTag = createMoliTag(jsDomWindow);
        jsDomWindow.sessionStorage.setItem(BrowserStorageKeys.moliEnv, 'production');
        adTag.configure(defaultConfig);
        expectEnvironment(adTag, 'production');
      });

      it('should not change the environment if the value is invalid', () => {
        const adTag = createMoliTag(jsDomWindow);
        jsDomWindow.sessionStorage.setItem(BrowserStorageKeys.moliEnv, 'wrong');
        adTag.configure(defaultConfig);
        expectEnvironment(adTag, undefined);
      });
    });

    describe('with local storage', () => {
      it('should override the environment with test', () => {
        const adTag = createMoliTag(jsDomWindow);
        jsDomWindow.localStorage.setItem(BrowserStorageKeys.moliEnv, 'test');
        adTag.configure(defaultConfig);
        expectEnvironment(adTag, 'test');
      });

      it('should override the environment with production', () => {
        const adTag = createMoliTag(jsDomWindow);
        jsDomWindow.localStorage.setItem(BrowserStorageKeys.moliEnv, 'production');
        adTag.configure(defaultConfig);
        expectEnvironment(adTag, 'production');
      });

      it('should not change the environment if the value is invalid', () => {
        const adTag = createMoliTag(jsDomWindow);
        jsDomWindow.localStorage.setItem(BrowserStorageKeys.moliEnv, 'wrong');
        adTag.configure(defaultConfig);
        expectEnvironment(adTag, undefined);
      });
    });

    describe('precedences', () => {
      it('query parameter has the highest precedence', () => {
        const adTag = createMoliTag(jsDomWindow);

        dom.reconfigure({
          url: 'https://localhost?moliEnv=test'
        });
        jsDomWindow.sessionStorage.setItem(BrowserStorageKeys.moliEnv, 'production');
        jsDomWindow.localStorage.setItem(BrowserStorageKeys.moliEnv, 'production');

        adTag.configure(defaultConfig);

        expectEnvironment(adTag, 'test');
      });

      it('session storage has a higher precedence than local storage', () => {
        const adTag = createMoliTag(jsDomWindow);

        jsDomWindow.sessionStorage.setItem(BrowserStorageKeys.moliEnv, 'test');
        jsDomWindow.localStorage.setItem(BrowserStorageKeys.moliEnv, 'production');

        adTag.configure(defaultConfig);

        expectEnvironment(adTag, 'test');
      });
    });
  });

  describe('multiple configurations', () => {
    it('should not miss any configuration', () => {
      const adTag = createMoliTag(jsDomWindow);
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
        schain: {
          supplyChainStartNode: dummySupplyChainNode
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

  describe('refreshInfiniteAdSlots()', () => {
    it('should add a new infinite slot to the config', async () => {
      const adTag = createMoliTag(jsDomWindow);
      const slots: AdSlot[] = [
        ...defaultSlots,
        { ...mkAdSlotInDOM(), behaviour: { loaded: 'infinite', selector: '.ad-infinite' } }
      ];

      adTag.configure({
        ...defaultConfig,
        slots: slots
      });

      await adTag.requestAds();
      await adTag.refreshInfiniteAdSlot('infinite-adslot-1', 'dom-id-2');

      expect(adTag.getState()).to.be.equal('finished');
      expect(adTag.getConfig()?.slots).to.have.length(3);
      expect(adTag.getConfig()?.slots.map(slot => slot.domId)).to.include('infinite-adslot-1');
    });

    it('should refresh the new infinite adslot if given configured slot id is available in the config', async () => {
      const domIdOfNewInfiniteSlot = 'infinite-adslot-1';
      const idOfConfiguredInfiniteSlot = 'my-id';

      const slots: AdSlot[] = [
        {
          ...mkAdSlotInDOM(),
          behaviour: { loaded: 'infinite', selector: '.ad-infinite' },
          domId: idOfConfiguredInfiniteSlot
        }
      ];

      const adTag = createMoliTag(jsDomWindow);
      const refreshSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'refresh');

      adTag.configure({
        ...defaultConfig,
        slots: slots
      });

      // Add div with domIdOfNewInfiniteSlot to DOM
      const div = jsDomWindow.document.createElement('div');
      div.setAttribute('id', domIdOfNewInfiniteSlot);
      div.setAttribute('class', 'ad-infinite');
      jsDomWindow.document.body.append(div);

      await adTag.refreshInfiniteAdSlot(domIdOfNewInfiniteSlot, idOfConfiguredInfiniteSlot);
      await adTag.requestAds();

      expect(refreshSpy).to.have.been.called;
      const domIds = (refreshSpy.firstCall.args[0] || []).map(slot => slot.getSlotElementId());
      expect(domIds).to.be.deep.eq([domIdOfNewInfiniteSlot]);
    });

    it('should NOT refresh the new infinite adslot if given configured slot id is NOT available in the config', async () => {
      const domIdOfNewInfiniteSlot = 'infinite-adslot-1';
      const idOfConfiguredInfiniteSlot = 'my-id';
      const idNotInTheConfig = 'my-id-2';

      const slots: AdSlot[] = [
        {
          ...mkAdSlotInDOM(),
          behaviour: { loaded: 'infinite', selector: '.ad-infinite' },
          domId: idOfConfiguredInfiniteSlot
        }
      ];

      const adTag = createMoliTag(jsDomWindow);
      const refreshSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'refresh');

      adTag.configure({
        ...defaultConfig,
        slots: slots
      });

      // Add div with domIdOfNewInfiniteSlot to DOM
      const div = jsDomWindow.document.createElement('div');
      div.setAttribute('id', domIdOfNewInfiniteSlot);
      jsDomWindow.document.body.append(div);

      await adTag.refreshInfiniteAdSlot(domIdOfNewInfiniteSlot, idNotInTheConfig);
      await adTag.requestAds();

      expect(refreshSpy).to.have.not.been.called;
    });
  });

  describe('requestAds', () => {
    describe('configurable state', () => {
      it('should add localhost as domain label in config', async () => {
        const adTag = createMoliTag(jsDomWindow);
        await adTag.requestAds();
        adTag.configure(newEmptyConfig());
        const config = adTag.getConfig();
        expect(config).to.be.ok;
        const labels = config?.targeting?.labels;
        expect(labels).to.be.ok;
        expect(labels).to.contain.oneOf(['localhost']);
      });

      it('should add apexDomain as domain label in config', async () => {
        dom.reconfigure({
          url: 'https://example.com'
        });
        const adTag = createMoliTag(jsDomWindow);
        await adTag.requestAds();
        adTag.configure(newEmptyConfig());
        const config = adTag.getConfig();
        expect(config).to.be.ok;
        const labels = config?.targeting?.labels;
        expect(labels).to.be.ok;
        expect(labels).to.contain.oneOf(['example.com']);
      });
    });

    describe('configured state', () => {
      it('should add ABtest targeting', async () => {
        const adTag = createMoliTag(jsDomWindow);
        adTag.configure(newEmptyConfig());
        await adTag.requestAds();
        const config = adTag.getConfig();
        expect(config).to.be.ok;
        const keyValues = config?.targeting?.keyValues;
        expect(keyValues).to.be.ok;
        expect(keyValues!.ABtest).to.be.ok;
      });

      it('should localhost as domain label in config', async () => {
        const adTag = createMoliTag(jsDomWindow);
        adTag.configure(newEmptyConfig());
        await adTag.requestAds();
        const config = adTag.getConfig();
        expect(config).to.be.ok;
        const labels = config?.targeting?.labels;
        expect(labels).to.be.ok;
        expect(labels).to.contain.oneOf(['localhost']);
      });

      it('should add top private domain as domain label in config', async () => {
        dom.reconfigure({
          url: 'https://example.com'
        });
        const adTag = createMoliTag(jsDomWindow);
        adTag.configure(newEmptyConfig());
        await adTag.requestAds();
        const config = adTag.getConfig();
        expect(config).to.be.ok;
        const labels = config?.targeting?.labels;
        expect(labels).to.be.ok;
        expect(labels).to.contain.oneOf(['example.com']);
      });

      it('should add top private domain as domain label from config', async () => {
        dom.reconfigure({
          url: 'https://example.com'
        });
        const adTag = createMoliTag(jsDomWindow);
        adTag.configure({ ...newEmptyConfig(), domain: 'sub.example.com' });
        await adTag.requestAds();
        const config = adTag.getConfig();
        expect(config).to.be.ok;
        const labels = config?.targeting?.labels;
        expect(labels).to.be.ok;
        expect(labels).to.contain.oneOf(['sub.example.com']);
      });
    });
  });
});
