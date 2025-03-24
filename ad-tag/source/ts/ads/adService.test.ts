import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { MoliRuntime } from '../types/moliRuntime';
import { createAssetLoaderService } from '../util/assetLoaderService';
import { IAdPipelineConfiguration, mkPrepareRequestAdsStep } from './adPipeline';
import { AdService } from './adService';
import {
  emptyConfig,
  emptyRuntimeConfig,
  emptyTestRuntimeConfig,
  newEmptyRuntimeConfig,
  noopLogger
} from '../stubs/moliStubs';
import { tcData, tcfapiFunction } from '../stubs/consentStubs';
import MoliLogger = MoliRuntime.MoliLogger;
import { dummySupplyChainNode } from '../stubs/schainStubs';
import { AdSlot, MoliConfig } from '../types/moliConfig';
import { afterEach } from 'mocha';
import { EventService } from 'ad-tag/ads/eventService';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('AdService', () => {
  let dom = createDom();
  let jsDomWindow: Window = dom.window as any;

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();
  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const eventService = new EventService();

  const emptyConfigWithPrebid: MoliConfig = {
    ...emptyConfig,
    prebid: {
      config: {
        currency: {
          adServerCurrency: 'EUR',
          defaultRates: {
            USD: { EUR: 1 }
          },
          granularityMultiplier: 1
        }
      },
      distributionUrl: 'https://cdn.h5v.eu/prebid/dist/8.52.0/prebid.js',
      schain: {
        nodes: []
      }
    }
  };

  const emptyConfigWithA9: MoliConfig = {
    ...emptyConfig,
    a9: {
      cmpTimeout: 500,
      timeout: 1000,
      pubID: '0000',
      schainNode: dummySupplyChainNode
    }
  };

  const withSpaEnabled = (config: MoliConfig): MoliConfig => ({
    ...config,
    spa: { enabled: true, validateLocation: 'href' }
  });

  const makeAdService = (): AdService => {
    const adPipelineConfiguration: IAdPipelineConfiguration = {
      init: [],
      configure: [],
      defineSlots: () => Promise.resolve([]),
      prepareRequestAds: [],
      requestBids: [],
      requestAds: () => Promise.resolve()
    };
    const service = new AdService(
      assetLoaderService,
      eventService,
      jsDomWindow,
      adPipelineConfiguration
    );
    service.setLogger(noopLogger);
    return service;
  };

  const initialize: (
    config?: MoliConfig,
    runtimeConfig?: MoliRuntime.MoliRuntimeConfig
  ) => Promise<IAdPipelineConfiguration> = async (
    config: MoliConfig = emptyConfig,
    runtimeConfig: MoliRuntime.MoliRuntimeConfig = emptyRuntimeConfig
  ): Promise<IAdPipelineConfiguration> => {
    const adService = makeAdService();
    await adService.initialize(config, runtimeConfig);
    return adService.getAdPipeline().config;
  };

  let domIdCounter: number = 0;
  const eagerAdSlot = (): AdSlot => {
    domIdCounter = domIdCounter + 1;
    return {
      domId: `dom-id-${domIdCounter}`,
      adUnitPath: `/123/ad-unit-${domIdCounter}`,
      sizes: [],
      position: 'in-page',
      sizeConfig: [],
      behaviour: { loaded: 'eager' }
    };
  };

  const createDomElementAndAddToDOM = (id: string): HTMLElement => {
    const adDiv = dom.window.document.createElement('div');
    adDiv.id = id;
    dom.window.document.body.appendChild(adDiv);
    return adDiv;
  };

  const addToDom = (adSlots: AdSlot[]): void => {
    adSlots.forEach(slot => createDomElementAndAddToDOM(slot.domId));
  };

  const manualAdSlot = (): AdSlot => {
    return { ...eagerAdSlot(), behaviour: { loaded: 'manual' } };
  };

  const backfillAdSlot = (): AdSlot => ({
    ...eagerAdSlot(),
    behaviour: { loaded: 'backfill' }
  });

  const infiniteSlot = (): AdSlot => ({
    ...eagerAdSlot(),
    behaviour: { loaded: 'infinite', selector: '.ad-infinite' }
  });

  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });

  beforeEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    dom.window.__tcfapi = tcfapiFunction(tcData);
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('initialize', () => {
    // FIXME try to make this test work
    it.skip('should wait until the dom is initialized', async () => {
      const documentLoadedSpy = sandbox.spy(dom.window.document, 'addEventListener');

      await initialize();
      expect(documentLoadedSpy).to.have.been.calledOnce;
      expect(documentLoadedSpy).to.have.been.calledOnceWithExactly('DOMContentLoaded');
    });

    it('should add the gptInit step', async () => {
      const pipeline = await initialize();
      const stepNames = pipeline.init.map(step => step.name);
      expect(stepNames).to.contain('gpt-init');
    });

    describe('bridge', () => {
      it('should init bridge', async () => {
        const pipeline = await initialize({ ...emptyConfig, bridge: { enabled: true } });
        const stepNames = pipeline.init.map(step => step.name);
        expect(stepNames).to.contain('bridge');
      });
    });

    describe('modules', () => {
      it('should add the modules-init step', async () => {
        const initStepSpy = sandbox.spy();
        const runtimeConfig = newEmptyRuntimeConfig();
        runtimeConfig.adPipelineConfig.initSteps.push(initStepSpy);
        const pipeline = await initialize(emptyConfig, runtimeConfig);
        expect(pipeline.init).to.deep.contain(initStepSpy);
      });

      it('should add the modules-configure step', async () => {
        const configureStepSpy = sandbox.spy();
        const runtimeConfig = newEmptyRuntimeConfig();
        runtimeConfig.adPipelineConfig.configureSteps.push(configureStepSpy);
        const pipeline = await initialize(emptyConfig, runtimeConfig);
        expect(pipeline.configure).to.deep.contain(configureStepSpy);
      });

      it('should add the modules-prepareRequestAds step', async () => {
        const prepareRequestAdsStepSpy = sandbox.spy();
        const prepareRequestAdsStep = mkPrepareRequestAdsStep(
          'prep-test',
          1,
          prepareRequestAdsStepSpy
        );
        const runtimeConfig = newEmptyRuntimeConfig();
        runtimeConfig.adPipelineConfig.prepareRequestAdsSteps.push(prepareRequestAdsStep);
        const pipeline = await initialize(emptyConfig, runtimeConfig);
        expect(pipeline.prepareRequestAds).to.deep.contain(prepareRequestAdsStepSpy);
      });

      it('should add the modules-requestsBids step', async () => {
        const requestBidsStepSpy = sandbox.spy();
        const runtimeConfig = newEmptyRuntimeConfig();
        runtimeConfig.adPipelineConfig.requestBidsSteps.push(requestBidsStepSpy);
        const pipeline = await initialize(emptyConfig, runtimeConfig);
        expect(pipeline.requestBids).to.deep.contain(requestBidsStepSpy);
      });
    });

    describe('prebid', () => {
      it('should add the prebid-init step if prebid is available', async () => {
        const pipeline = await initialize(emptyConfigWithPrebid);
        const stepNames = pipeline.init.map(step => step.name);
        expect(stepNames).to.contain('prebid-init');
      });

      it('should not add the prebid-init step if prebid is not available', async () => {
        const pipeline = await initialize();
        const stepNames = pipeline.init.map(step => step.name);
        expect(stepNames).not.to.contain('prebid-init');
      });
    });

    describe('a9', () => {
      it('should add the a9-init step if a9 is available', async () => {
        const pipeline = await initialize(emptyConfigWithA9);
        const stepNames = pipeline.init.map(step => step.name);
        expect(stepNames).to.contain('a9-init');
      });

      it('should not add the a9-init step if a9 is not available', async () => {
        const pipeline = await initialize();
        const stepNames = pipeline.init.map(step => step.name);
        expect(stepNames).not.to.contain('a9-init');
      });
    });
  });

  describe('configure', () => {
    it('should add the gptConfigure step', async () => {
      const pipeline = await initialize();
      const stepNames = pipeline.configure.map(step => step.name);
      expect(stepNames).to.contain('gpt-configure');
    });

    it('should add the gpt-destroy-ad-slots for single page apps', async () => {
      const pipeline = await initialize(withSpaEnabled(emptyConfig), emptyRuntimeConfig);
      const stepNames = pipeline.configure.map(step => step.name);
      expect(stepNames).to.contain('gpt-destroy-ad-slots');
    });

    it('should not add the gpt-destroy-ad-slots for none single page apps', async () => {
      const pipeline = await initialize();
      const stepNames = pipeline.configure.map(step => step.name);
      expect(stepNames).not.to.contain('gpt-destroy-ad-slots');
    });

    it('should add the gpt-reset-targeting for single page apps', async () => {
      const pipeline = await initialize(withSpaEnabled(emptyConfig), emptyRuntimeConfig);
      const stepNames = pipeline.configure.map(step => step.name);
      expect(stepNames).to.contain('gpt-reset-targeting');
    });

    it('should not add the gpt-reset-targeting for none single page apps', async () => {
      const pipeline = await initialize();
      const stepNames = pipeline.configure.map(step => step.name);
      expect(stepNames).not.to.contain('gpt-reset-targeting');
    });

    describe('prebid', () => {
      it('should add pbjs if available in the config', async () => {
        const pipeline = await initialize(emptyConfigWithPrebid);
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).to.contain('prebid-configure');
      });

      it('should not initialize pbjs if not set in the config', async () => {
        const pipeline = await initialize();
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).not.to.contain('prebid-configure');
      });

      it('should add the prebid-remove-adunits for single page apps', async () => {
        const pipeline = await initialize(
          withSpaEnabled(emptyConfigWithPrebid),
          emptyRuntimeConfig
        );
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).to.contain('prebid-remove-adunits');
      });

      it('should not add the prebid-remove-adunits for none single page apps', async () => {
        const pipeline = await initialize(emptyConfigWithPrebid, emptyRuntimeConfig);
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).not.to.contain('prebid-remove-adunits');
      });

      it('should not add the prebid-remove-adunits for single page apps if prebid is not available', async () => {
        const pipeline = await initialize(emptyConfig, emptyRuntimeConfig);
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).not.to.contain('prebid-remove-adunits');
      });
    });

    describe('a9', () => {
      it('should initialize apstag if available in config', async () => {
        const pipeline = await initialize(emptyConfigWithA9);
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).to.contain('a9-configure');
      });

      it('should not initialize apstag if not available in config', async () => {
        const pipeline = await initialize();
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).not.to.contain('a9-configure');
      });

      it('should configure publisher audiences if available', async () => {
        const pipeline = await initialize(emptyConfigWithA9);
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).to.contain('a9-publisher-audiences');
      });
    });
  });

  describe('defineSlots', () => {
    it('should add the gptDefineSlots step', async () => {
      const pipeline = await initialize();
      expect(pipeline.defineSlots).to.be.ok;
    });
  });

  describe('prepareRequestAds', () => {
    describe('gpt', () => {
      it('should add the gpt-device-label-keyValue step', async () => {
        const pipeline = await initialize();
        const stepNames = pipeline.prepareRequestAds.map(step => step.name);
        expect(stepNames).to.contain('gpt-device-label-keyValue');
      });

      it('should add the gpt-consent-keyValue step', async () => {
        const pipeline = await initialize();
        const stepNames = pipeline.prepareRequestAds.map(step => step.name);
        expect(stepNames).to.contain('gpt-consent-keyValue');
      });
    });

    describe('prebid', () => {
      it('should add the prebid-prepare-adunits step if prebid is available', async () => {
        const pipeline = await initialize(emptyConfigWithPrebid);
        const stepNames = pipeline.prepareRequestAds.map(step => step.name);
        expect(stepNames).to.contain('prebid-prepare-adunits');
      });

      it('should not add the prebid-prepare-adunits step if prebid is not available', async () => {
        const pipeline = await initialize();
        const stepNames = pipeline.prepareRequestAds.map(step => step.name);
        expect(stepNames).not.to.contain('prebid-prepare-adunits');
      });
    });

    describe('a9', () => {
      it('should add the a9-clear-targeting-step step if a9 is available', async () => {
        const pipeline = await initialize(emptyConfigWithA9);
        const stepNames = pipeline.prepareRequestAds.map(step => step.name);
        expect(stepNames).to.contain('a9-clear-targeting');
      });
    });
  });

  describe('requestBids', () => {
    describe('prebid', () => {
      it('should add the request prebid bids step if prebid is available', async () => {
        const pipeline = await initialize(emptyConfigWithPrebid);
        const stepNames = pipeline.requestBids.map(step => step.name);
        expect(stepNames).to.contain('prebid-request-bids');
      });

      it('should not add the request prebid bids step if prebid is not available', async () => {
        const pipeline = await initialize();
        const stepNames = pipeline.requestBids.map(step => step.name);
        expect(stepNames).not.to.contain('prebid-request-bids');
      });
    });
    describe('a9', () => {
      it('should add the a9 fetch bids step if a9 is available', async () => {
        const pipeline = await initialize(emptyConfigWithA9);
        const stepNames = pipeline.requestBids.map(step => step.name);
        expect(stepNames).to.contain('a9-fetch-bids');
      });

      it('should not the a9 fetch bids step if a9 is not available', async () => {
        const pipeline = await initialize();
        const stepNames = pipeline.requestBids.map(step => step.name);
        expect(stepNames).not.to.contain('a9-fetch-bids');
      });
    });
  });

  describe('requestAds', () => {
    const requestAds = (
      slots: AdSlot[],
      refreshSlots: string[] = [],
      refreshInfiniteSlots: MoliRuntime.IRefreshInfiniteSlot[],
      logger: MoliLogger = noopLogger
    ): Promise<AdSlot[]> => {
      const adService = makeAdService();
      adService.setLogger(logger);
      return adService.requestAds(
        { ...emptyConfig, slots: slots },
        { ...emptyRuntimeConfig, refreshSlots, refreshInfiniteSlots }
      );
    };

    const addToDom = (adSlots: AdSlot[]): void => {
      adSlots.forEach(slot => {
        const adDiv = dom.window.document.createElement('div');
        adDiv.id = slot.domId;
        dom.window.document.body.appendChild(adDiv);
      });
    };

    it('should return an empty slots array for any empty slots array input', () => {
      return expect(requestAds([], [], [])).to.eventually.be.deep.equals([]);
    });

    it('should filter out all slots that are not available in the DOM', () => {
      return expect(requestAds([eagerAdSlot()], [], [])).to.eventually.be.deep.equals([]);
    });

    it('should filter out all slots that are not available in the DOM except out-of-page-interstitials', () => {
      const outOfPageInterstitial: AdSlot = {
        ...eagerAdSlot(),
        position: 'out-of-page-interstitial'
      };
      const slots = [outOfPageInterstitial];
      return expect(requestAds(slots, [], [])).to.eventually.be.deep.equals(slots);
    });

    it('should return all eagerly loaded slots that are available in the DOM', async () => {
      const eagerSlots = [eagerAdSlot(), eagerAdSlot()];
      const slots = [...eagerSlots, backfillAdSlot(), manualAdSlot()];
      addToDom(slots);
      const result = await requestAds(slots, [], []);
      expect(result).to.be.deep.equals(eagerSlots);
    });

    it('should return all manual slots if present in the refreshSlots array', async () => {
      const slot1 = manualAdSlot();
      const slot2 = manualAdSlot();
      const slots = [slot1, slot2];
      addToDom(slots);
      const result = await requestAds(slots, [slot1.domId], []);
      expect(result).to.be.deep.equals([slot1]);
    });

    it('should return all infinite slots if present in the refreshSlots array', async () => {
      const slot1 = infiniteSlot();
      const slots = [slot1];
      addToDom(slots);
      createDomElementAndAddToDOM('another-id');
      const result = await requestAds(
        slots,
        [],
        [{ artificialDomId: slot1.domId, idOfConfiguredSlot: 'another-id' }]
      );
      expect(result).to.be.deep.equals([slot1]);
    });

    describe('slot buckets', () => {
      describe('generic buckets', () => {
        const eagerAdSlot1: AdSlot = {
          ...eagerAdSlot(),
          behaviour: { loaded: 'eager', bucket: 'bucket1' }
        };

        const eagerAdSlot3: AdSlot = {
          ...eagerAdSlot(),
          behaviour: { loaded: 'eager' }
        };

        const allSlots = [eagerAdSlot1, eagerAdSlot3];
        it('should load ad slots in specified buckets', async () => {
          const adService = makeAdService();
          const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
          const debugStub = sandbox.stub();
          const logger: MoliRuntime.MoliLogger = { ...noopLogger, debug: debugStub };
          adService.setLogger(logger);

          addToDom(allSlots);
          const moliConfig = {
            ...emptyConfig,
            buckets: { enabled: true },
            slots: allSlots
          };

          await adService.requestAds(moliConfig, emptyRuntimeConfig);

          expect(runSpy).to.have.been.calledTwice;
          expect(runSpy.firstCall).to.have.been.calledWith(
            Sinon.match.array.deepEquals([eagerAdSlot1]),
            Sinon.match.same(moliConfig),
            Sinon.match.same(emptyRuntimeConfig),
            Sinon.match.number
          );

          expect(debugStub).to.have.been.calledWithExactly(
            'AdPipeline',
            `running bucket bucket1, slots:`,
            [eagerAdSlot1]
          );

          expect(debugStub).to.have.been.calledWithExactly(
            'AdPipeline',
            `running bucket default, slots:`,
            [eagerAdSlot3]
          );
        });

        it('should not load ad slots in specified buckets if disabled', async () => {
          const adService = makeAdService();
          adService.setLogger(noopLogger);
          const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');

          addToDom(allSlots);
          const moliConfig = {
            ...emptyConfig,
            buckets: { enabled: false },
            slots: allSlots
          };

          await adService.requestAds(moliConfig, emptyRuntimeConfig);

          expect(runSpy).to.have.been.calledOnce;
          expect(runSpy.firstCall).to.have.been.calledWith(
            Sinon.match.array.deepEquals(allSlots),
            Sinon.match.same(moliConfig),
            Sinon.match.same(emptyRuntimeConfig),
            Sinon.match.number
          );
        });

        it('should not load ad slots in specified buckets if no bucket config is provided', async () => {
          const adService = makeAdService();
          adService.setLogger(noopLogger);
          const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');

          addToDom(allSlots);
          const moliConfig = {
            ...emptyConfig,
            slots: allSlots
          };

          await adService.requestAds(moliConfig, emptyRuntimeConfig);

          expect(runSpy).to.have.been.calledOnce;
          expect(runSpy.firstCall).to.have.been.calledWith(
            Sinon.match.array.deepEquals(allSlots),
            Sinon.match.same(moliConfig),
            Sinon.match.same(emptyRuntimeConfig),
            Sinon.match.number
          );
        });
      });

      describe('device specific buckets', () => {
        [
          {
            testName: 'should run pipeline twice for mobile if buckets differ',
            deviceLabel: 'mobile',
            slot1Bucket: { mobile: 'content', desktop: 'page' },
            slot2Bucket: { mobile: 'page', desktop: 'page' }
          },
          {
            testName: 'should run pipeline twice for mobile if buckets differ #2',
            deviceLabel: 'mobile',
            slot1Bucket: { mobile: 'content', desktop: 'page' },
            slot2Bucket: 'page'
          },
          {
            testName: 'should run pipeline twice for desktop if buckets differ',
            deviceLabel: 'desktop',
            slot1Bucket: { mobile: 'page', desktop: 'content' },
            slot2Bucket: { mobile: 'page', desktop: 'page' }
          },
          {
            testName: 'should run pipeline twice for desktop if buckets differ #2',
            deviceLabel: 'desktop',
            slot1Bucket: { mobile: 'page', desktop: 'content' },
            slot2Bucket: 'page'
          }
        ].forEach(({ testName, deviceLabel, slot1Bucket, slot2Bucket }) => {
          it(testName, async () => {
            const adService = makeAdService();
            const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
            const slot1: AdSlot = {
              ...eagerAdSlot(),
              behaviour: { loaded: 'eager', bucket: slot1Bucket }
            };

            const slot2: AdSlot = {
              ...eagerAdSlot(),
              behaviour: { loaded: 'eager', bucket: slot2Bucket }
            };
            addToDom([slot1, slot2]);

            const moliConfig = {
              ...emptyConfig,
              buckets: { enabled: true },
              slots: [slot1, slot2]
            };

            await adService.requestAds(moliConfig, {
              ...emptyRuntimeConfig,
              labels: [deviceLabel]
            });
            expect(runSpy).to.have.been.calledTwice;
            expect(runSpy.firstCall).to.have.been.calledWith(
              Sinon.match.array.deepEquals([slot1]),
              Sinon.match.same(moliConfig),
              Sinon.match.any,
              Sinon.match.number
            );
            expect(runSpy.secondCall).to.have.been.calledWith(
              Sinon.match.array.deepEquals([slot2]),
              Sinon.match.same(moliConfig),
              Sinon.match.any,
              Sinon.match.number
            );
          });
        });

        //
        [
          {
            testName: 'should run pipeline once for mobile if buckets differ',
            deviceLabel: 'mobile',
            slot1Bucket: { mobile: 'content', desktop: 'content' },
            slot2Bucket: { mobile: 'content', desktop: 'page' }
          },
          {
            testName: 'should run pipeline once for mobile if buckets differ #2',
            deviceLabel: 'mobile',
            slot1Bucket: { mobile: 'content', desktop: 'page' },
            slot2Bucket: 'content'
          },
          {
            testName: 'should run pipeline once for desktop if buckets differ',
            deviceLabel: 'desktop',
            slot1Bucket: { mobile: 'content', desktop: 'content' },
            slot2Bucket: { mobile: 'page', desktop: 'content' }
          },
          {
            testName: 'should run pipeline once for desktop if buckets differ #2',
            deviceLabel: 'desktop',
            slot1Bucket: { mobile: 'page', desktop: 'content' },
            slot2Bucket: 'content'
          }
        ].forEach(({ testName, deviceLabel, slot1Bucket, slot2Bucket }) => {
          it(testName, async () => {
            const adService = makeAdService();
            const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
            const slot1: AdSlot = {
              ...eagerAdSlot(),
              behaviour: { loaded: 'eager', bucket: slot1Bucket }
            };

            const slot2: AdSlot = {
              ...eagerAdSlot(),
              behaviour: { loaded: 'eager', bucket: slot2Bucket }
            };
            addToDom([slot1, slot2]);

            const moliConfig = {
              ...emptyConfig,
              buckets: { enabled: true },
              slots: [slot1, slot2]
            };

            await adService.requestAds(moliConfig, {
              ...emptyRuntimeConfig,
              labels: [deviceLabel]
            });
            expect(adService.getAdPipeline().run).to.have.been.calledOnce;
            expect(adService.getAdPipeline().run).to.have.been.calledWith(
              Sinon.match.array.deepEquals([slot1, slot2]),
              Sinon.match.same(moliConfig),
              Sinon.match.any,
              Sinon.match.number
            );
          });
        });
      });
    });

    describe('events', () => {
      it('should emit a beforeRequestAds event with the runtimeConfig', async () => {
        const adService = makeAdService();
        const listenerSpy = sandbox.spy();
        eventService.addEventListener('beforeRequestAds', listenerSpy);
        await adService.requestAds(emptyConfig, emptyRuntimeConfig);
        expect(listenerSpy).to.have.been.calledOnce;
        expect(listenerSpy).to.have.been.calledWith({ runtimeConfig: emptyRuntimeConfig });
      });

      it('should emit an afterRequestAds event the result state', async () => {
        const adService = makeAdService();
        const listenerSpy = sandbox.spy();
        eventService.addEventListener('afterRequestAds', listenerSpy);
        await adService.requestAds(emptyConfig, emptyRuntimeConfig);
        expect(listenerSpy).to.have.been.calledOnce;
        expect(listenerSpy).to.have.been.calledWith({ state: 'finished' });
      });
    });
  });

  describe('refreshAdSlots', () => {
    const backfillSlot: AdSlot = { ...eagerAdSlot(), behaviour: { loaded: 'backfill' } };
    const infiniteSlot: AdSlot = {
      ...eagerAdSlot(),
      behaviour: { loaded: 'infinite', selector: '.ad-infinite' }
    };

    it('should do nothing if domIds is empty', async () => {
      const adService = makeAdService();
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots([], emptyConfig, emptyRuntimeConfig);
      expect(runSpy).to.not.have.been.called;
    });

    it('should call adPipeline.run with an empty array if no slots are available', async () => {
      const adService = makeAdService();
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots(['content_1'], emptyConfig, emptyRuntimeConfig);
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        [],
        emptyConfig,
        emptyRuntimeConfig,
        Sinon.match.number
      );
    });

    it('should call adPipeline.run with an empty array if slots are available, but not in DOM', async () => {
      const adService = makeAdService();
      const slot = manualAdSlot();
      const configWithManualSlot: MoliConfig = {
        ...emptyConfig,
        slots: [slot]
      };
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots([slot.domId], configWithManualSlot, emptyRuntimeConfig);
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        [],
        configWithManualSlot,
        emptyRuntimeConfig,
        Sinon.match.number
      );
    });

    it('should call adPipeline.run with an empty array if slot is eager', async () => {
      const adService = makeAdService();
      const slot = eagerAdSlot();
      const configWithEagerSlot: MoliConfig = {
        ...emptyConfig,
        slots: [slot]
      };
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots([slot.domId], configWithEagerSlot, emptyRuntimeConfig);
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        [],
        configWithEagerSlot,
        emptyRuntimeConfig,
        Sinon.match.number
      );
    });

    it('should call adPipeline.run with an empty array if slot is backfill', async () => {
      const adService = makeAdService();
      const configWithEagerSlot: MoliConfig = {
        ...emptyConfig,
        slots: [backfillSlot]
      };
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots([backfillSlot.domId], configWithEagerSlot, emptyRuntimeConfig);
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        [],
        configWithEagerSlot,
        emptyRuntimeConfig,
        Sinon.match.number
      );
    });

    it('should call adPipeline.run with the slot if slot is manual', async () => {
      const adService = makeAdService();
      const slot = manualAdSlot();
      const configWithManualSlot: MoliConfig = {
        ...emptyConfig,
        slots: [slot]
      };
      addToDom([slot]);

      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots([slot.domId], configWithManualSlot, emptyRuntimeConfig);
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        [slot],
        configWithManualSlot,
        emptyRuntimeConfig,
        Sinon.match.number
      );
    });

    it('should call adPipeline.run with the slot if slot is infinite', async () => {
      const adService = makeAdService();
      const configWithManualSlot: MoliConfig = {
        ...emptyConfig,
        slots: [infiniteSlot]
      };
      addToDom([infiniteSlot]);
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots(
        [infiniteSlot.domId],
        configWithManualSlot,
        emptyRuntimeConfig
      );
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        [infiniteSlot],
        configWithManualSlot,
        emptyRuntimeConfig,
        Sinon.match.number
      );
    });

    it('should call adPipeline.run with the slot if backfill is provided as loaded option', async () => {
      const adService = makeAdService();
      const configWithManualSlot: MoliConfig = {
        ...emptyConfig,
        slots: [backfillSlot]
      };
      addToDom([backfillSlot]);
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots(
        [backfillSlot.domId],
        configWithManualSlot,
        emptyRuntimeConfig,
        {
          loaded: 'backfill'
        }
      );
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        [backfillSlot],
        configWithManualSlot,
        emptyRuntimeConfig,
        Sinon.match.number
      );
    });

    it('should call adPipeline.run with the backfill and infinite slot if backfill is provided as loaded option', async () => {
      const adService = makeAdService();
      const configWithManualSlot: MoliConfig = {
        ...emptyConfig,
        slots: [backfillSlot, infiniteSlot]
      };
      addToDom([backfillSlot, infiniteSlot]);
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots(
        [backfillSlot.domId, infiniteSlot.domId],
        configWithManualSlot,
        emptyRuntimeConfig,
        {
          loaded: 'backfill'
        }
      );
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        [backfillSlot, infiniteSlot],
        configWithManualSlot,
        emptyRuntimeConfig,
        Sinon.match.number
      );
    });

    it('should call adPipeline.run with updates slots with the options.sizesOverride', async () => {
      const adService = makeAdService();
      const slot: AdSlot = {
        ...manualAdSlot(),
        sizes: [
          [300, 250],
          [300, 600]
        ]
      };
      const configWithManualSlot: MoliConfig = {
        ...emptyConfig,
        slots: [slot]
      };
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      addToDom([slot]);

      await adService.refreshAdSlots([slot.domId], configWithManualSlot, emptyRuntimeConfig, {
        sizesOverride: [[300, 250]]
      });
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        Sinon.match.array.deepEquals([{ ...slot, sizes: [[300, 250]] }]),
        configWithManualSlot,
        emptyRuntimeConfig,
        Sinon.match.number
      );
    });

    it('should call adPipeline.run with updates slots with the options.sizesOverride even if they are not part of the original sizes', async () => {
      const adService = makeAdService();
      const slot: AdSlot = {
        ...manualAdSlot(),
        sizes: [[300, 250]]
      };
      const configWithManualSlot: MoliConfig = {
        ...emptyConfig,
        slots: [slot]
      };
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      addToDom([slot]);

      await adService.refreshAdSlots([slot.domId], configWithManualSlot, emptyRuntimeConfig, {
        sizesOverride: [[300, 600]]
      });
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        Sinon.match.array.deepEquals([{ ...slot, sizes: [[300, 600]] }]),
        configWithManualSlot,
        emptyRuntimeConfig,
        Sinon.match.number
      );
    });
  });

  describe('refresh bucket', () => {
    const withBucket = (adSlot: AdSlot, bucket: string): AdSlot => ({
      ...adSlot,
      behaviour: { loaded: adSlot.behaviour.loaded, bucket }
    });

    const bucketMoliConfig = (slots: AdSlot[]): MoliConfig => ({
      ...emptyConfig,
      buckets: { enabled: true },
      slots
    });

    let adService: AdService = makeAdService();
    let runSpy = sandbox.spy(adService.getAdPipeline(), 'run');

    beforeEach(() => {
      adService = makeAdService();
      runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
    });

    it('should not call adPipeline.run if the ad slots are not in the DOM', async () => {
      const slot: AdSlot = withBucket(manualAdSlot(), 'bucket1');
      const moliConfig = bucketMoliConfig([slot]);
      await adService.refreshBucket('bucket1', moliConfig, emptyTestRuntimeConfig);
      expect(runSpy).to.not.have.been.called;
    });

    it('should not call adPipeline.run if no slots are in the bucket', async () => {
      const slot: AdSlot = withBucket(manualAdSlot(), 'bucket1');
      addToDom([slot]);
      const moliConfig = bucketMoliConfig([slot]);
      await adService.refreshBucket('bucket2', moliConfig, emptyTestRuntimeConfig);
      expect(runSpy).to.not.have.been.called;
    });

    it('should call adPipeline.run with the slots in the bucket', async () => {
      const slot1: AdSlot = withBucket(manualAdSlot(), 'bucket1');
      const slot2: AdSlot = withBucket(eagerAdSlot(), 'bucket1');

      addToDom([slot1, slot2]);

      const moliConfig = bucketMoliConfig([slot1, slot2]);

      await adService.refreshBucket('bucket1', moliConfig, emptyTestRuntimeConfig);
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        Sinon.match.array.deepEquals([slot1]),
        Sinon.match.same(moliConfig),
        Sinon.match.same(emptyTestRuntimeConfig),
        Sinon.match.number,
        Sinon.match.same('bucket1')
      );
    });

    it('should call adPipeline.run with the slots in the bucket and the options', async () => {
      const slot1: AdSlot = withBucket(manualAdSlot(), 'bucket1');
      const slot2: AdSlot = withBucket(eagerAdSlot(), 'bucket1');
      addToDom([slot1, slot2]);

      const moliConfig = bucketMoliConfig([slot1, slot2]);
      await adService.refreshBucket('bucket1', moliConfig, emptyTestRuntimeConfig, {
        loaded: 'eager'
      });
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        Sinon.match.array.deepEquals([slot2]),
        Sinon.match.same(moliConfig),
        Sinon.match.same(emptyTestRuntimeConfig),
        Sinon.match.number,
        Sinon.match.same('bucket1')
      );
    });

    it('should override slot sizes from options', async () => {
      const slot1: AdSlot = withBucket(manualAdSlot(), 'bucket1');
      addToDom([slot1]);

      const moliConfig = bucketMoliConfig([slot1]);
      await adService.refreshBucket('bucket1', moliConfig, emptyTestRuntimeConfig, {
        sizesOverride: [[300, 250]]
      });
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        Sinon.match.array.deepEquals([{ ...slot1, sizes: [[300, 250]] }]),
        Sinon.match.same(moliConfig),
        Sinon.match.same(emptyTestRuntimeConfig),
        Sinon.match.number,
        Sinon.match.same('bucket1')
      );
    });
  });

  describe('global auction context', () => {
    it('should instantiate auction in adPipeline by default config', async () => {
      const emptyConfigWithGlobalAuction: MoliConfig = {
        ...emptyConfig,
        globalAuctionContext: undefined
      };
      const adService = makeAdService();
      await adService.initialize(emptyConfigWithGlobalAuction, emptyRuntimeConfig);
      expect(adService.getAdPipeline().getAuction()).to.be.ok;
    });

    it('should instantiate auction in adPipeline with config', async () => {
      const emptyConfigWithGlobalAuction: MoliConfig = {
        ...emptyConfig,
        globalAuctionContext: {
          adRequestThrottling: { enabled: true, throttle: 15 },
          biddersDisabling: {
            enabled: false,
            minBidRequests: 2,
            minRate: 0.2,
            reactivationPeriod: 3600000
          }
        }
      };
      const adService = makeAdService();
      await adService.initialize(emptyConfigWithGlobalAuction, emptyRuntimeConfig);
      expect(adService.getAdPipeline().getAuction()).to.be.ok;
    });
  });
});
