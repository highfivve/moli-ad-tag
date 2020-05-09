import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { Moli } from '../../../source/ts/types/moli';
import { createAssetLoaderService } from '../../../source/ts/util/assetLoaderService';
import { IAdPipelineConfiguration } from '../../../source/ts/ads/adPipeline';
import { AdService } from '../../../source/ts/ads/adService';
import { emptyConfig } from '../stubs/moliStubs';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

// tslint:disable: no-unused-expression
describe('AdService', () => {

  const adSlot: Moli.AdSlot = {
    domId: 'dom-id',
    adUnitPath: '/123/dom-id',
    behaviour: { loaded: 'eager' },
    position: 'in-page',
    sizes: [],
    sizeConfig: []
  };

  const dom = createDom();

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();
  const assetLoaderService = createAssetLoaderService(dom.window);

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
      }
    }
  };

  const emptyConfigWithA9: Moli.MoliConfig = {
    ...emptyConfig,
    a9: {
      cmpTimeout: 500,
      timeout: 1000,
      pubID: '0000'
    }
  };


  const initialize = (config: Moli.MoliConfig = emptyConfig, isSinglePageApp: boolean = false): Promise<IAdPipelineConfiguration> => {
    const adService = new AdService(assetLoaderService, dom.window);
    return adService.initialize(config, isSinglePageApp).then(() => adService.getAdPipeline().config);
  };

  const getElementByIdStub = sandbox.stub(dom.window.document, 'getElementById');


  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });

  beforeEach(() => {

    // by default all DOM elements exist
    getElementByIdStub.returns({} as HTMLElement);
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('initialize', () => {

    it('should add the await-dom-ready step', () => {
      return initialize().then(pipeline => {
        const stepNames = pipeline.init.map(step => step.name);
        expect(stepNames).to.contain('await-dom-ready');
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
      it('should add the a9-init step if prebid is available', () => {
        return initialize(emptyConfigWithA9).then(pipeline => {
          const stepNames = pipeline.init.map(step => step.name);
          expect(stepNames).to.contain('a9-init');
        });
      });

      it('should not add the a9-init step if prebid is not available', () => {
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

    it('should not add the gpt-personalized-ads step if a cmp module is not available', () => {
      const config: Moli.MoliConfig = { ...emptyConfig, consent: {} };
      return initialize(config).then(pipeline => {
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).not.to.contain('gpt-personalized-ads');
      });
    });

    it('should add the gpt-personalized-ads step if a cmp module is available', () => {
      return initialize().then(pipeline => {
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).to.contain('gpt-personalized-ads');
      });
    });

    it('should add the reporting-configured step', () => {
      return initialize().then(pipeline => {
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).to.contain('reporting-configured');
      });
    });

    it('should add the slot-event-service-configure step', () => {
      return initialize().then(pipeline => {
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).to.contain('slot-event-service-configure');
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

    describe('yieldOptimization', () => {
      it('should add the yield-optimization step', () => {
        return initialize(emptyConfigWithPrebid).then(pipeline => {
          const stepNames = pipeline.prepareRequestAds.map(step => step.name);
          expect(stepNames).to.contain('yield-optimization');
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
});
