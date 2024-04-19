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

  const initialize = (
    config: Moli.MoliConfig = emptyConfig,
    isSinglePageApp: boolean = false
  ): Promise<IAdPipelineConfiguration> => {
    const adService = new AdService(assetLoaderService, jsDomWindow);
    return adService
      .initialize(config, isSinglePageApp)
      .then(() => adService.getAdPipeline().config);
  };

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
    let domIdCounter: number = 0;

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

    const eventTrigger: Moli.behaviour.Trigger = {
      name: 'event',
      event: 'noop',
      source: jsDomWindow
    };

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

    const manualAdSlot = (): Moli.AdSlot => {
      return { ...eagerAdSlot(), behaviour: { loaded: 'manual' } };
    };

    const addToDom = (adSlots: Moli.AdSlot[]): void => {
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
      const outOfPageInterstitial: Moli.AdSlot = {
        ...eagerAdSlot(),
        position: 'out-of-page-interstitial'
      };
      const slots = [outOfPageInterstitial];
      return expect(requestAds(slots, [], [])).to.eventually.be.deep.equals(slots);
    });

    it('should return all eagerly loaded slots that are available in the DOM', () => {
      const slots = [eagerAdSlot(), eagerAdSlot()];
      addToDom(slots);
      return expect(requestAds(slots, [], [])).to.eventually.be.deep.equals(slots);
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
});
