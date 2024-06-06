import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { Moli } from '../types/moli';
import { createAssetLoaderService } from '../util/assetLoaderService';
import { IAdPipelineConfiguration } from './adPipeline';
import { AdService } from './adService';
import { emptyConfig, noopLogger } from '../stubs/moliStubs';
import { tcData, tcfapiFunction } from '../stubs/consentStubs';
import MoliLogger = Moli.MoliLogger;
import { dummySupplyChainNode } from '../stubs/schainStubs';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('AdService', () => {
  let dom = createDom();
  let jsDomWindow: Window = dom.window as any;

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();
  const assetLoaderService = createAssetLoaderService(jsDomWindow);

  const emptyConfigWithPrebid: Moli.MoliConfig = {
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
      distributionUrls: {
        es6: 'cdn.h5v.eu/prebid.js/build/dist1_es6_78/Prebid.js/build/dist/prebid.js?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=OQVKDH6RSRHZPWO8QNJ1%2F20240606%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20240606T152055Z&X-Amz-Expires=604800&X-Amz-Security-Token=eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NLZXkiOiJPUVZLREg2UlNSSFpQV084UU5KMSIsImV4cCI6MTcxNzcyNTM4MSwicGFyZW50IjoiamVua2lucyJ9.-MoMIkxI89GPZt2NK_ZJDBduoK8nl74djxa_4rh9VoGn8n3ugrg6p4FWgtkmflHIIOMYeiIUEFjBwHIZq7C--g&X-Amz-SignedHeaders=host&versionId=8b815343-515c-434d-a166-ce011181c174&X-Amz-Signature=19cd11fa12307c8633852f67b973b9c7a9a738a79cffa3e0c361e5f7d63653a8'
      },
      schain: {
        nodes: []
      }
    }
  };

  const emptyConfigWithA9: Moli.MoliConfig = {
    ...emptyConfig,
    a9: {
      cmpTimeout: 500,
      timeout: 1000,
      pubID: '0000',
      schainNode: dummySupplyChainNode
    }
  };

  const makeAdService = (): AdService => {
    const adPipelineConfiguration: IAdPipelineConfiguration = {
      init: [],
      configure: [],
      defineSlots: () => Promise.resolve([]),
      prepareRequestAds: [],
      requestBids: [],
      requestAds: () => Promise.resolve()
    };
    return new AdService(assetLoaderService, jsDomWindow, adPipelineConfiguration);
  };

  const initialize: (
    config?: Moli.MoliConfig,
    isSinglePageApp?: boolean
  ) => Promise<IAdPipelineConfiguration> = (
    config: Moli.MoliConfig = emptyConfig,
    isSinglePageApp: boolean = false
  ): Promise<IAdPipelineConfiguration> => {
    const adService = makeAdService();
    return adService
      .initialize(config, isSinglePageApp)
      .then(() => adService.getAdPipeline().config);
  };

  let domIdCounter: number = 0;
  const eagerAdSlot = (): Moli.AdSlot => {
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

  const addToDom = (adSlots: Moli.AdSlot[]): void => {
    adSlots.forEach(slot => createDomElementAndAddToDOM(slot.domId));
  };

  const manualAdSlot = (): Moli.AdSlot => {
    return { ...eagerAdSlot(), behaviour: { loaded: 'manual' } };
  };

  const backfillAdSlot = (): Moli.AdSlot => ({
    ...eagerAdSlot(),
    behaviour: { loaded: 'backfill' }
  });

  const infiniteSlot = (): Moli.AdSlot => ({
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
    it.skip('should wait until the dom is initialized', () => {
      const documentLoadedSpy = sandbox.spy(dom.window.document, 'addEventListener');

      return initialize().then(() => {
        expect(documentLoadedSpy).to.have.been.calledOnce;
        expect(documentLoadedSpy).to.have.been.calledOnceWithExactly('DOMContentLoaded');
      });
    });

    it('should add the gptInit step', () => {
      return initialize().then(pipeline => {
        const stepNames = pipeline.init.map(step => step.name);
        expect(stepNames).to.contain('gpt-init');
      });
    });

    describe('prebid', () => {
      it('should add the prebid-init step if prebid is available', () => {
        return initialize(emptyConfigWithPrebid).then(pipeline => {
          const stepNames = pipeline.init.map(step => step.name);
          expect(stepNames).to.contain('prebid-init');
        });
      });

      it('should not add the prebid-init step if prebid is not available', () => {
        return initialize().then(pipeline => {
          const stepNames = pipeline.init.map(step => step.name);
          expect(stepNames).not.to.contain('prebid-init');
        });
      });
    });

    describe('a9', () => {
      it('should add the a9-init step if a9 is available', () => {
        return initialize(emptyConfigWithA9).then(pipeline => {
          const stepNames = pipeline.init.map(step => step.name);
          expect(stepNames).to.contain('a9-init');
        });
      });

      it('should not add the a9-init step if a9 is not available', () => {
        return initialize().then(pipeline => {
          const stepNames = pipeline.init.map(step => step.name);
          expect(stepNames).not.to.contain('a9-init');
        });
      });
    });
  });

  describe('configure', () => {
    it('should add the gptConfigure step', () => {
      return initialize().then(pipeline => {
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).to.contain('gpt-configure');
      });
    });

    it('should add the gpt-destroy-ad-slots for single page apps', () => {
      return initialize(emptyConfig, true).then(pipeline => {
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).to.contain('gpt-destroy-ad-slots');
      });
    });

    it('should not add the gpt-destroy-ad-slots for none single page apps', () => {
      return initialize().then(pipeline => {
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).not.to.contain('gpt-destroy-ad-slots');
      });
    });

    it('should add the gpt-reset-targeting for single page apps', () => {
      return initialize(emptyConfig, true).then(pipeline => {
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).to.contain('gpt-reset-targeting');
      });
    });

    it('should not add the gpt-reset-targeting for none single page apps', () => {
      return initialize().then(pipeline => {
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).not.to.contain('gpt-reset-targeting');
      });
    });

    describe('prebid', () => {
      it('should add pbjs if available in the config', () => {
        return initialize(emptyConfigWithPrebid).then(pipeline => {
          const stepNames = pipeline.configure.map(step => step.name);
          expect(stepNames).to.contain('prebid-configure');
        });
      });

      it('should not initialize pbjs if not set in the config', () => {
        return initialize().then(pipeline => {
          const stepNames = pipeline.configure.map(step => step.name);
          expect(stepNames).not.to.contain('prebid-configure');
        });
      });

      it('should add the prebid-remove-adunits for single page apps', () => {
        return initialize(emptyConfigWithPrebid, true).then(pipeline => {
          const stepNames = pipeline.configure.map(step => step.name);
          expect(stepNames).to.contain('prebid-remove-adunits');
        });
      });

      it('should not add the prebid-remove-adunits for none single page apps', () => {
        return initialize(emptyConfigWithPrebid, false).then(pipeline => {
          const stepNames = pipeline.configure.map(step => step.name);
          expect(stepNames).not.to.contain('prebid-remove-adunits');
        });
      });

      it('should not add the prebid-remove-adunits for single page apps if prebid is not available', () => {
        return initialize(emptyConfig, false).then(pipeline => {
          const stepNames = pipeline.configure.map(step => step.name);
          expect(stepNames).not.to.contain('prebid-remove-adunits');
        });
      });
    });

    describe('a9', () => {
      it('should initialize apstag if available in config', () => {
        return initialize(emptyConfigWithA9).then(pipeline => {
          const stepNames = pipeline.configure.map(step => step.name);
          expect(stepNames).to.contain('a9-configure');
        });
      });

      it('should not initialize apstag if not available in config', () => {
        return initialize().then(pipeline => {
          const stepNames = pipeline.configure.map(step => step.name);
          expect(stepNames).not.to.contain('a9-configure');
        });
      });

      it('should configure publisher audiences if available', () => {
        return initialize(emptyConfigWithA9).then(pipeline => {
          const stepNames = pipeline.configure.map(step => step.name);
          expect(stepNames).to.contain('a9-publisher-audiences');
        });
      });
    });
  });

  describe('defineSlots', () => {
    it('should add the gptDefineSlots step', () => {
      return initialize().then(pipeline => {
        expect(pipeline.defineSlots).to.be.ok;
      });
    });
  });

  describe('prepareRequestAds', () => {
    describe('gpt', () => {
      it('should add the gpt-device-label-keyValue step', () => {
        return initialize().then(pipeline => {
          const stepNames = pipeline.prepareRequestAds.map(step => step.name);
          expect(stepNames).to.contain('gpt-device-label-keyValue');
        });
      });

      it('should add the gpt-consent-keyValue step', () => {
        return initialize().then(pipeline => {
          const stepNames = pipeline.prepareRequestAds.map(step => step.name);
          expect(stepNames).to.contain('gpt-consent-keyValue');
        });
      });
    });

    describe('prebid', () => {
      it('should add the prebid-prepare-adunits step if prebid is available', () => {
        return initialize(emptyConfigWithPrebid).then(pipeline => {
          const stepNames = pipeline.prepareRequestAds.map(step => step.name);
          expect(stepNames).to.contain('prebid-prepare-adunits');
        });
      });

      it('should not add the prebid-prepare-adunits step if prebid is not available', () => {
        return initialize().then(pipeline => {
          const stepNames = pipeline.prepareRequestAds.map(step => step.name);
          expect(stepNames).not.to.contain('prebid-prepare-adunits');
        });
      });
    });

    describe('a9', () => {
      it('should add the a9-clear-targeting-step step if a9 is available', () => {
        return initialize(emptyConfigWithA9).then(pipeline => {
          const stepNames = pipeline.prepareRequestAds.map(step => step.name);
          expect(stepNames).to.contain('a9-clear-targeting');
        });
      });
    });

    describe('passback', () => {
      it('should configure passback slots', () => {
        return initialize(emptyConfigWithPrebid).then(pipeline => {
          const stepNames = pipeline.prepareRequestAds.map(step => step.name);
          expect(stepNames).to.contain('passback-prepare-slots');
        });
      });
    });

    describe('reporting', () => {
      it('should not add the reporting-enabled step if no reporter is set', () => {
        return initialize().then(pipeline => {
          const stepNames = pipeline.prepareRequestAds.map(step => step.name);
          expect(stepNames).to.not.contain('reporting-enabled');
        });
      });

      it('should add the reporting-enabled step if reporting config is set', () => {
        return initialize({
          ...emptyConfig,
          reporting: {
            sampleRate: 1,
            reporters: []
          }
        }).then(pipeline => {
          const stepNames = pipeline.prepareRequestAds.map(step => step.name);
          expect(stepNames).to.contain('reporting-enabled');
        });
      });
    });
  });

  describe('requestBids', () => {
    describe('prebid', () => {
      it('should add the request prebid bids step if prebid is available', () => {
        return initialize(emptyConfigWithPrebid).then(pipeline => {
          const stepNames = pipeline.requestBids.map(step => step.name);
          expect(stepNames).to.contain('prebid-request-bids');
        });
      });

      it('should not add the request prebid bids step if prebid is not available', () => {
        return initialize().then(pipeline => {
          const stepNames = pipeline.requestBids.map(step => step.name);
          expect(stepNames).not.to.contain('prebid-request-bids');
        });
      });
    });
    describe('a9', () => {
      it('should add the a9 fetch bids step if a9 is available', () => {
        return initialize(emptyConfigWithA9).then(pipeline => {
          const stepNames = pipeline.requestBids.map(step => step.name);
          expect(stepNames).to.contain('a9-fetch-bids');
        });
      });

      it('should not the a9 fetch bids step if a9 is not available', () => {
        return initialize().then(pipeline => {
          const stepNames = pipeline.requestBids.map(step => step.name);
          expect(stepNames).not.to.contain('a9-fetch-bids');
        });
      });
    });
  });

  describe('requestAds', () => {
    const requestAds = (
      slots: Moli.AdSlot[],
      refreshSlots: string[] = [],
      refreshInfiniteSlots: Moli.state.IRefreshInfiniteSlot[],
      logger: MoliLogger = noopLogger
    ): Promise<Moli.AdSlot[]> => {
      const adService = makeAdService();
      adService.setLogger(logger);
      return adService.requestAds(
        { ...emptyConfig, slots: slots },
        refreshSlots,
        refreshInfiniteSlots
      );
    };

    it('should return an empty slots array for any empty slots array input', () => {
      return expect(requestAds([], [], [])).to.eventually.be.deep.equals([]);
    });

    it('should filter out all slots that are not available in the DOM', () => {
      return expect(requestAds([eagerAdSlot()], [], [])).to.eventually.be.deep.equals([]);
    });

    it('should filter out all slots that are not available in the DOM except out-of-page-interstitials', () => {
      const outOfPageInterstitial: Moli.AdSlot = {
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
      const eagerAdSlot1: Moli.AdSlot = {
        ...eagerAdSlot(),
        behaviour: { loaded: 'eager', bucket: 'bucket1' }
      };

      const eagerAdSlot3: Moli.AdSlot = {
        ...eagerAdSlot(),
        behaviour: { loaded: 'eager' }
      };

      const allSlots = [eagerAdSlot1, eagerAdSlot3];

      it('should load ad slots in specified buckets', async () => {
        const adService = makeAdService();
        const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
        const debugStub = sandbox.stub();
        const logger: Moli.MoliLogger = { ...noopLogger, debug: debugStub };
        adService.setLogger(logger);

        addToDom(allSlots);

        await adService.requestAds(
          {
            ...emptyConfig,
            buckets: { enabled: true },
            slots: allSlots
          },
          [],
          []
        );

        expect(runSpy).to.have.been.calledTwice;
        expect(runSpy.firstCall).to.have.been.calledWith(
          Sinon.match.array.deepEquals([eagerAdSlot1]),
          Sinon.match.any,
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

        await adService.requestAds(
          {
            ...emptyConfig,
            buckets: { enabled: false },
            slots: allSlots
          },
          [],
          []
        );

        expect(runSpy).to.have.been.calledOnce;
        expect(runSpy.firstCall).to.have.been.calledWith(
          Sinon.match.array.deepEquals(allSlots),
          Sinon.match.any,
          Sinon.match.number
        );
      });

      it('should not load ad slots in specified buckets if no bucket config is provided', async () => {
        const adService = makeAdService();
        adService.setLogger(noopLogger);
        const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');

        addToDom(allSlots);

        await adService.requestAds(
          {
            ...emptyConfig,
            slots: allSlots
          },
          [],
          []
        );

        expect(runSpy).to.have.been.calledOnce;
        expect(runSpy.firstCall).to.have.been.calledWith(
          Sinon.match.array.deepEquals(allSlots),
          Sinon.match.any,
          Sinon.match.number
        );
      });
    });
  });

  describe('refreshAdSlots', () => {
    const backfillSlot: Moli.AdSlot = { ...eagerAdSlot(), behaviour: { loaded: 'backfill' } };
    const infiniteSlot: Moli.AdSlot = {
      ...eagerAdSlot(),
      behaviour: { loaded: 'infinite', selector: '.ad-infinite' }
    };

    it('should do nothing if domIds is empty', async () => {
      const adService = makeAdService();
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots([], emptyConfig);
      expect(runSpy).to.not.have.been.called;
    });

    it('should call adPipeline.run with an empty array if no slots are available', async () => {
      const adService = makeAdService();
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots(['content_1'], emptyConfig);
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly([], emptyConfig, Sinon.match.number);
    });

    it('should call adPipeline.run with an empty array if slots are available, but not in DOM', async () => {
      const adService = makeAdService();
      const slot = manualAdSlot();
      const configWithManualSlot: Moli.MoliConfig = {
        ...emptyConfig,
        slots: [slot]
      };
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots([slot.domId], configWithManualSlot);
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly([], configWithManualSlot, Sinon.match.number);
    });

    it('should call adPipeline.run with an empty array if slot is eager', async () => {
      const adService = makeAdService();
      const slot = eagerAdSlot();
      const configWithEagerSlot: Moli.MoliConfig = {
        ...emptyConfig,
        slots: [slot]
      };
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots([slot.domId], configWithEagerSlot);
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly([], configWithEagerSlot, Sinon.match.number);
    });

    it('should call adPipeline.run with an empty array if slot is backfill', async () => {
      const adService = makeAdService();
      const configWithEagerSlot: Moli.MoliConfig = {
        ...emptyConfig,
        slots: [backfillSlot]
      };
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots([backfillSlot.domId], configWithEagerSlot);
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly([], configWithEagerSlot, Sinon.match.number);
    });

    it('should call adPipeline.run with the slot if slot is manual', async () => {
      const adService = makeAdService();
      const slot = manualAdSlot();
      const configWithManualSlot: Moli.MoliConfig = {
        ...emptyConfig,
        slots: [slot]
      };
      addToDom([slot]);

      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots([slot.domId], configWithManualSlot);
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        [slot],
        configWithManualSlot,
        Sinon.match.number
      );
    });

    it('should call adPipeline.run with the slot if slot is infinite', async () => {
      const adService = makeAdService();
      const configWithManualSlot: Moli.MoliConfig = {
        ...emptyConfig,
        slots: [infiniteSlot]
      };
      addToDom([infiniteSlot]);
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots([infiniteSlot.domId], configWithManualSlot);
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        [infiniteSlot],
        configWithManualSlot,
        Sinon.match.number
      );
    });

    it('should call adPipeline.run with the slot if backfill is provided as loaded option', async () => {
      const adService = makeAdService();
      const configWithManualSlot: Moli.MoliConfig = {
        ...emptyConfig,
        slots: [backfillSlot]
      };
      addToDom([backfillSlot]);
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots([backfillSlot.domId], configWithManualSlot, {
        loaded: 'backfill'
      });
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        [backfillSlot],
        configWithManualSlot,
        Sinon.match.number
      );
    });

    it('should call adPipeline.run with the backfill and infinite slot if backfill is provided as loaded option', async () => {
      const adService = makeAdService();
      const configWithManualSlot: Moli.MoliConfig = {
        ...emptyConfig,
        slots: [backfillSlot, infiniteSlot]
      };
      addToDom([backfillSlot, infiniteSlot]);
      const runSpy = sandbox.spy(adService.getAdPipeline(), 'run');
      await adService.refreshAdSlots(
        [backfillSlot.domId, infiniteSlot.domId],
        configWithManualSlot,
        {
          loaded: 'backfill'
        }
      );
      expect(runSpy).to.have.been.calledOnce;
      expect(runSpy).to.have.been.calledWithExactly(
        [backfillSlot, infiniteSlot],
        configWithManualSlot,
        Sinon.match.number
      );
    });
  });

  describe('global auction context', () => {
    it('should instantiate auction in adPipeline by default config', async () => {
      const emptyConfigWithGlobalAuction: Moli.MoliConfig = {
        ...emptyConfig,
        globalAuctionContext: undefined
      };
      const adService = makeAdService();
      await adService.initialize(emptyConfigWithGlobalAuction, true);
      expect(adService.getAdPipeline().getAuction()).to.be.ok;
    });

    it('should instantiate auction in adPipeline with config', async () => {
      const emptyConfigWithGlobalAuction: Moli.MoliConfig = {
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
      await adService.initialize(emptyConfigWithGlobalAuction, true);
      expect(adService.getAdPipeline().getAuction()).to.be.ok;
    });
  });
});
