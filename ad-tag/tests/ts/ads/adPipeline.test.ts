import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { googletag } from '../../../source/ts/types/googletag';
import { prebidjs } from '../../../source/ts/types/prebidjs';
import { apstag } from '../../../source/ts/types/apstag';
import { DfpService } from '../../../source/ts/ads/dfpService';
import { Moli } from '../../../source/ts/types/moli';
import { createAssetLoaderService, AssetLoadMethod } from '../../../source/ts/util/assetLoaderService';
import { cookieService } from '../../../source/ts/util/cookieService';
import { createGoogletagStub, googleAdSlotStub } from '../stubs/googletagStubs';
import { pbjsStub, pbjsTestConfig } from '../stubs/prebidjsStubs';
import { apstagStub, a9ConfigStub } from '../stubs/a9Stubs';
import { cmpModule, consentConfig, emptyConfig, noopLogger } from '../stubs/moliStubs';
import YieldOptimizationConfig = Moli.yield_optimization.YieldOptimizationConfig;
import { AdPipeline, IAdPipelineConfiguration } from '../../../source/ts/ads/adPipeline';
import { reportingServiceStub } from '../stubs/reportingServiceStub';
import { SlotEventService } from '../../../source/ts/ads/slotEventService';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

// tslint:disable: no-unused-expression
describe('AdPipeline', () => {

  const emptyPipelineConfig: IAdPipelineConfiguration = {
    init: [],
    configure: [],
    defineSlots: () => Promise.resolve([]),
    prepareRequestAds: [],
    requestBids: [],
    requestAds: () => Promise.resolve()
  };

  const adSlot: Moli.AdSlot = {
    domId: 'dom-id',
    adUnitPath: '/123/dom-id',
    behaviour: { loaded: 'eager' },
    position: 'in-page',
    sizes: [],
    sizeConfig: []
  };

  const dom = createDom();

  const googletagStub = createGoogletagStub();
  const pubAdsServiceStub = googletagStub.pubads();
  // set globals before test
  dom.window.googletag = googletagStub;
  dom.window.pbjs = pbjsStub;

  dom.window.apstag = apstagStub;

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();
  const assetLoaderService = createAssetLoaderService(dom.window);

  const assetLoaderFetch = sandbox.stub(assetLoaderService, 'loadScript');
  const matchMediaStub = sandbox.stub(dom.window, 'matchMedia');

  const reportingService = reportingServiceStub();

  const slotEventService = new SlotEventService(noopLogger);

  // googletag spies
  const googletagDefineSlotStub = sandbox.stub(dom.window.googletag, 'defineSlot');
  const googleTagPubAdsSpy = sandbox.spy(dom.window.googletag, 'pubads');
  const googletagDefineOutOfPageSlotStub = sandbox.stub(dom.window.googletag, 'defineOutOfPageSlot');
  const pubAdsServiceStubRefreshSpy = sandbox.spy(pubAdsServiceStub, 'refresh');
  const setTargetingStub = sandbox.spy(dom.window.googletag.pubads(), 'setTargeting');

  // pbjs spies
  const pbjsAddAdUnitSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
  const pbjsRequestBidsSpy = sandbox.spy(dom.window.pbjs, 'requestBids');
  const pbjsSetTargetingForGPTAsyncSpy = sandbox.spy(dom.window.pbjs, 'setTargetingForGPTAsync');

  // a9 apstag spies
  const apstagFetchBidsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
  const apstagSetDisplayBidsSpy = sandbox.spy(dom.window.apstag, 'setDisplayBids');

  // create a new DfpService for testing
  const newAdPipeline = (config: IAdPipelineConfiguration): AdPipeline => {
    return new AdPipeline(config, noopLogger, dom.window, reportingService, slotEventService);
  };

  const getElementByIdStub = sandbox.stub(dom.window.document, 'getElementById');

  const sleep = (timeInMs: number = 20) => new Promise(resolve => {
    setTimeout(resolve, timeInMs);
  });

  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });

  beforeEach(() => {
    // reset the before each test
    dom.window.googletag = googletagStub;
    dom.window.pbjs = pbjsStub;
    dom.window.apstag = apstagStub;

    // by default resolve all assets
    assetLoaderFetch.resolves();

    // by default all DOM elements exist
    getElementByIdStub.returns({} as HTMLElement);

    // default stub behaviour
    googletagDefineSlotStub.callThrough();
    googletagDefineOutOfPageSlotStub.callThrough();
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('run', () => {

    it('should not run when the slots array is empty', () => {
      const pipeline = newAdPipeline(emptyPipelineConfig);
      return pipeline.run([], emptyConfig).then(() => {
        expect(googletagDefineSlotStub).has.not.been.called;
      });
    });

    it('should fail if the init phase fails', () => {
      const pipeline = newAdPipeline({ ...emptyPipelineConfig, init: [ () => Promise.reject('init failed') ] });
      return expect(pipeline.run([ adSlot ], emptyConfig)).eventually.be.rejectedWith('init failed');
    });

  });

});
