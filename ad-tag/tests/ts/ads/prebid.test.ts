import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { Moli } from '../../../source/ts/types/moli';
import { prebidjs } from '../../../source/ts/types/prebidjs';

import { emptyConfig, noopLogger } from '../stubs/moliStubs';
import { AdPipelineContext, } from '../../../source/ts/ads/adPipeline';
import { SlotEventService } from '../../../source/ts/ads/slotEventService';
import {
  prebidConfigure,
  prebidPrepareRequestAds
} from '../../../source/ts/ads/prebid';
import { noopReportingService } from '../../../source/ts/ads/reportingService';
import { LabelConfigService } from '../../../source/ts/ads/labelConfigService';
import { createPbjsStub, pbjsTestConfig } from '../stubs/prebidjsStubs';
import { googleAdSlotStub } from '../stubs/googletagStubs';


// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

// tslint:disable: no-unused-expression
describe('prebid', () => {

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const dom = createDom();
  const adPipelineContext = (env: Moli.Environment = 'production', config: Moli.MoliConfig = emptyConfig, requestAdsCalls: number = 1): AdPipelineContext => {
    return {
      requestId: 0,
      requestAdsCalls: requestAdsCalls,
      env: env,
      logger: noopLogger,
      config: config,
      window: dom.window,
      labelConfigService: new LabelConfigService([], [], dom.window),
      reportingService: noopReportingService,
      slotEventService: new SlotEventService(noopLogger)
    };
  };

  let domIdCounter: number = 0;
  const mediumRec: [ number, number ][] = [ [ 300, 250 ] ];

  const getDomId = (): string => {
    domIdCounter = domIdCounter + 1;
    return `dom-id-${domIdCounter}`;
  };

  const prebidSlot = (domId: string, provider: Moli.headerbidding.PrebidAdSlotConfigProvider): Moli.PrebidAdSlot => {
    domIdCounter = domIdCounter + 1;
    return {
      domId: domId,
      adUnitPath: `/123/${domId}`,
      sizes: mediumRec,
      position: 'in-page',
      sizeConfig: [],
      prebid: provider,
      behaviour: { loaded: 'eager' }
    };
  };

  const prebidAdUnit = (domId: string, bids: prebidjs.IBid[], sizes: [ number, number ][] = mediumRec): prebidjs.IAdUnit => {
    return {
      code: domId,
      mediaTypes: {
        banner: { sizes }
      },
      bids: bids
    };
  };

  const createSlotDefinitions = (domId: string, provider: Moli.headerbidding.PrebidAdSlotConfigProvider): Moli.SlotDefinition => {
    const slot = prebidSlot(domId, provider);
    return {
      moliSlot: slot,
      adSlot: googleAdSlotStub(slot.adUnitPath, slot.domId),
      filterSupportedSizes: (sizes) => sizes
    };
  };


  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });

  beforeEach(() => {
    // reset the before each test
    dom.window.pbjs = createPbjsStub();
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('prebid configure step', () => {
    it('should set the prebid config', () => {
      const prebidConfig: Moli.headerbidding.PrebidConfig = {
        config: pbjsTestConfig
      };
      const step = prebidConfigure(prebidConfig);
      const setConfigSpy = sandbox.spy(dom.window.pbjs, 'setConfig');

      return step(adPipelineContext(), []).then(() => {
        expect(setConfigSpy).to.have.been.calledOnce;
        expect(setConfigSpy).to.have.been.calledOnceWithExactly(pbjsTestConfig);
      });
    });
  });

  describe('prebid prepare request ads', () => {

    it('should add empty adunits array when the slots array is empty', () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
      const step = prebidPrepareRequestAds();

      return step(adPipelineContext(), []).then(() => {
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([]);
      });
    });


    describe('static ad slot config provider', () => {
      it('should add empty adunits array when the static prebid config provider is an empty array', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds();

        const domId = getDomId();
        const singleSlot = createSlotDefinitions(domId, []);

        return step(adPipelineContext(), [ singleSlot ]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([]);
        });
      });

      it('should add a single adunit when the static prebid config provider returns a single bid', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds();

        const domId = getDomId();
        const adUnit = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' } }
        ]);
        const singleSlot = createSlotDefinitions(domId, { adUnit });

        return step(adPipelineContext(), [ singleSlot ]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([ adUnit ]);
        });
      });

      it('should add a single adunit when the static prebid config provider returns a single bid array', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds();

        const domId = getDomId();
        const adUnit = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' } }
        ]);
        const singleSlot = createSlotDefinitions(domId, [ { adUnit } ]);

        return step(adPipelineContext(), [ singleSlot ]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([ adUnit ]);
        });
      });

      it('should add a two adunits when the static prebid config provider returns a two bids', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds();

        const domId = getDomId();
        const adUnit1 = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' } }
        ]);
        const adUnit2 = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '124' } }
        ]);
        const singleSlot = createSlotDefinitions(domId, [ { adUnit: adUnit1 }, { adUnit: adUnit2 } ]);

        return step(adPipelineContext(), [ singleSlot ]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([ adUnit1, adUnit2 ]);
        });
      });

      it('should add a single adunit when the static prebid config provider returns a two bids but one is filtered', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds();

        const domId = getDomId();
        const adUnit1 = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' } }
        ]);
        // empty sizes, so it should be filtered out
        const adUnit2 = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '124' } }
        ], []);
        const singleSlot = createSlotDefinitions(domId, [ { adUnit: adUnit1 }, { adUnit: adUnit2 } ]);

        return step(adPipelineContext(), [ singleSlot ]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([ adUnit1 ]);
        });
      });
    });

    describe('dynamic ad slot config provider', () => {
      it('should add empty adunits array when the dynamic prebid config provider is an empty array', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds();

        const domId = getDomId();
        const singleSlot = createSlotDefinitions(domId, () => []);

        return step(adPipelineContext(), [ singleSlot ]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([]);
        });
      });

      it('should add a single adunit when the dynamic prebid config provider returns a single bid', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds();

        const domId = getDomId();
        const adUnit = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' } }
        ]);
        const singleSlot = createSlotDefinitions(domId, () => {
          return { adUnit };
        });

        return step(adPipelineContext(), [ singleSlot ]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([ adUnit ]);
        });
      });

      it('should add a single adunit when the dynamic prebid config provider returns a single bid array', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds();

        const domId = getDomId();
        const adUnit = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' } }
        ]);
        const singleSlot = createSlotDefinitions(domId, () => {
          return [ { adUnit } ];
        });

        return step(adPipelineContext(), [ singleSlot ]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([ adUnit ]);
        });
      });

      it('should add a two adunits when the dynamic prebid config provider returns a two bids', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds();

        const domId = getDomId();
        const adUnit1 = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' } }
        ]);
        const adUnit2 = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '124' } }
        ]);
        const singleSlot = createSlotDefinitions(domId, () => [ { adUnit: adUnit1 }, { adUnit: adUnit2 } ]);

        return step(adPipelineContext(), [ singleSlot ]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([ adUnit1, adUnit2 ]);
        });
      });

      it('should add a single adunit when the dynamic prebid config provider returns a two bids but one is filtered', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds();

        const domId = getDomId();
        const adUnit1 = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' } }
        ]);
        // empty sizes, so it should be filtered out
        const adUnit2 = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '124' } }
        ], []);
        const singleSlot = createSlotDefinitions(domId, () => [ { adUnit: adUnit1 }, { adUnit: adUnit2 } ]);

        return step(adPipelineContext(), [ singleSlot ]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([ adUnit1 ]);
        });
      });

    });

  });
});
