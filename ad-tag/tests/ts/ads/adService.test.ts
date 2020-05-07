import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { Moli } from '../../../source/ts/types/moli';
import { createAssetLoaderService } from '../../../source/ts/util/assetLoaderService';
import {
  AdPipeline,
  AdPipelineContext,
  ConfigureStep,
  IAdPipelineConfiguration,
  InitStep
} from '../../../source/ts/ads/adPipeline';
import { AdService } from '../../../source/ts/ads/adService';
import { emptyConfig } from '../stubs/moliStubs';
import { gptInit } from '../../../source/ts/ads/googleAdManager';

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
        expect(pipeline.init).to.have.length.greaterThan(0);
        const stepNames = pipeline.init.map(step => step.name);
        expect(stepNames).to.contain('await-dom-ready');
      });
    });

    it('should add the gptInit step', () => {
      return initialize().then(pipeline => {
        expect(pipeline.init).to.have.length.greaterThan(0);
        const stepNames = pipeline.init.map(step => step.name);
        expect(stepNames).to.contain('gpt-init');
      });
    });
  });

  describe('configure', () => {
    it('should add the gptConfigure step', () => {
      return initialize().then(pipeline => {
        expect(pipeline.configure).to.have.length.greaterThan(0);
        const stepNames = pipeline.configure.map(step => step.name);
        expect(stepNames).to.contain('gpt-configure');
      });
    });

    describe('prebid', () => {
      it('initialize pbjs', () => {
        expect.fail('not implemented yet');
      });
    });

    describe('a9', () => {
      it('initialize apstag', () => {
        expect.fail('not implemented yet');
      });
    });

  });

  describe('defineSlots', () => {
    it('should add the gptDefineStlos step', () => {
      expect.fail('not implemented yet');
    });
  });

  describe('prepareRequestAds', () => {

    describe('prebid', () => {
      it('should add the gptDefineStlos step', () => {
        expect.fail('not implemented yet');
      });
    });

    describe('yieldOptimization', () => {
      it('should enhance ad slots with yield optimizations', () => {
        expect.fail('not implemented yet');
      });
      it('should set the price rule in the given slot definitions', () => {
        expect.fail('not implemented yet');
      });
    });

    describe('passback', () => {
      it('should configure passback slots', () => {
        expect.fail('not implemented yet');
      });
    });
  });

  describe('requestBids', () => {
    describe('prebid', () => {
      it('should request prebid bids', () => {
        expect.fail('not implemented yet');
      });
    });
    describe('a9', () => {
      it('request a9 bids', () => {
        expect.fail('not implemented yet');
      });
    });
  });
});
