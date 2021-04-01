import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { Moli } from '../types/moli';
import { prebidjs } from '../types/prebidjs';

import { emptyConfig, noopLogger } from '../stubs/moliStubs';
import { AdPipelineContext } from './adPipeline';
import { SlotEventService } from './slotEventService';
import { prebidConfigure, prebidPrepareRequestAds, prebidRequestBids } from './prebid';
import { noopReportingService } from './reportingService';
import { LabelConfigService } from './labelConfigService';
import { createPbjsStub, pbjsTestConfig } from '../stubs/prebidjsStubs';
import { googleAdSlotStub } from '../stubs/googletagStubs';
import { tcData } from '../stubs/consentStubs';
import { googletag } from '../types/googletag';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('prebid', () => {
  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const dom = createDom();
  const jsDomWindow: Window &
    googletag.IGoogleTagWindow &
    prebidjs.IPrebidjsWindow = dom.window as any;
  const adPipelineContext = (
    env: Moli.Environment = 'production',
    config: Moli.MoliConfig = emptyConfig,
    requestAdsCalls: number = 1
  ): AdPipelineContext => {
    return {
      requestId: 0,
      requestAdsCalls: requestAdsCalls,
      env: env,
      logger: noopLogger,
      config: config,
      window: jsDomWindow,
      labelConfigService: new LabelConfigService([], [], jsDomWindow),
      reportingService: noopReportingService,
      slotEventService: new SlotEventService(noopLogger),
      tcData: tcData
    };
  };

  let domIdCounter: number = 0;
  const mediumRec: [number, number][] = [[300, 250]];

  const getDomId = (): string => {
    domIdCounter = domIdCounter + 1;
    return `dom-id-${domIdCounter}`;
  };

  const prebidSlot = (
    domId: string,
    provider: Moli.headerbidding.PrebidAdSlotConfigProvider
  ): Moli.PrebidAdSlot => {
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

  const createAdSlot = (domId: string): Moli.AdSlot => {
    domIdCounter = domIdCounter + 1;
    return {
      domId: domId,
      adUnitPath: `/123/${domId}`,
      sizes: mediumRec,
      position: 'in-page',
      sizeConfig: [],
      behaviour: { loaded: 'eager' }
    };
  };

  const prebidAdUnit = (
    domId: string,
    bids: prebidjs.IBid[],
    sizes: [number, number][] = mediumRec
  ): prebidjs.IAdUnit => {
    return {
      code: domId,
      mediaTypes: {
        banner: { sizes }
      },
      bids: bids
    };
  };

  const createSlotDefinitions = (
    domId: string,
    provider: Moli.headerbidding.PrebidAdSlotConfigProvider
  ): Moli.SlotDefinition => {
    const slot = prebidSlot(domId, provider);
    return {
      moliSlot: slot,
      adSlot: googleAdSlotStub(slot.adUnitPath, slot.domId),
      filterSupportedSizes: sizes => sizes
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

    it('should use the code property if set', async () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
      const step = prebidPrepareRequestAds();

      const domId = getDomId();
      const code = 'not-the-domid';
      const adUnit = {
        ...prebidAdUnit(domId, [{ bidder: 'appnexus', params: { placementId: '123' } }]),
        code: code
      };
      const singleSlot = createSlotDefinitions(domId, { adUnit });

      await step(adPipelineContext(), [singleSlot]);
      expect(addAdUnitsSpy).to.have.been.calledOnce;
      expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit]);
    });

    it('should pass along arbitrary additional properties', async () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
      const step = prebidPrepareRequestAds();

      const domId = getDomId();
      const adUnit = {
        ...prebidAdUnit(domId, [{ bidder: 'appnexus', params: { placementId: '123' } }]),
        foo: {
          bar: 'baz'
        }
      } as any;
      const singleSlot = createSlotDefinitions(domId, { adUnit });

      await step(adPipelineContext(), [singleSlot]);
      expect(addAdUnitsSpy).to.have.been.calledOnce;
      expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit]);
    });

    describe('labels', () => {
      it('should remove labelAll', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds();

        const domId = getDomId();
        const adUnit = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' }, labelAll: ['mobile'] }
        ]);
        const singleSlot = createSlotDefinitions(domId, { adUnit });

        return step(adPipelineContext(), [singleSlot]).then(() => {
          const expectedAdUnit: prebidjs.IAdUnit = {
            ...adUnit,
            bids: [{ bidder: 'appnexus', params: { placementId: '123' } }]
          };
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([expectedAdUnit]);
        });
      });

      it('should remove labelAny', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds();

        const domId = getDomId();
        const adUnit = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' }, labelAny: ['mobile'] }
        ]);
        const singleSlot = createSlotDefinitions(domId, { adUnit });

        return step(adPipelineContext(), [singleSlot]).then(() => {
          const expectedAdUnit: prebidjs.IAdUnit = {
            ...adUnit,
            bids: [{ bidder: 'appnexus', params: { placementId: '123' } }]
          };
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([expectedAdUnit]);
        });
      });
    });

    describe('static ad slot config provider', () => {
      it('should add empty adunits array when the static prebid config provider is an empty array', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds();

        const domId = getDomId();
        const singleSlot = createSlotDefinitions(domId, []);

        return step(adPipelineContext(), [singleSlot]).then(() => {
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

        return step(adPipelineContext(), [singleSlot]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit]);
        });
      });

      it('should add a single adunit when the static prebid config provider returns a single bid array', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds();

        const domId = getDomId();
        const adUnit = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' } }
        ]);
        const singleSlot = createSlotDefinitions(domId, [{ adUnit }]);

        return step(adPipelineContext(), [singleSlot]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit]);
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
        const singleSlot = createSlotDefinitions(domId, [{ adUnit: adUnit1 }, { adUnit: adUnit2 }]);

        return step(adPipelineContext(), [singleSlot]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit1, adUnit2]);
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
        const adUnit2 = prebidAdUnit(
          domId,
          [{ bidder: 'appnexus', params: { placementId: '124' } }],
          []
        );
        const singleSlot = createSlotDefinitions(domId, [{ adUnit: adUnit1 }, { adUnit: adUnit2 }]);

        return step(adPipelineContext(), [singleSlot]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit1]);
        });
      });
    });

    describe('dynamic ad slot config provider', () => {
      it('should add empty adunits array when the dynamic prebid config provider is an empty array', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds();

        const domId = getDomId();
        const singleSlot = createSlotDefinitions(domId, () => []);

        return step(adPipelineContext(), [singleSlot]).then(() => {
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

        return step(adPipelineContext(), [singleSlot]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit]);
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
          return [{ adUnit }];
        });

        return step(adPipelineContext(), [singleSlot]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit]);
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
        const singleSlot = createSlotDefinitions(domId, () => [
          { adUnit: adUnit1 },
          { adUnit: adUnit2 }
        ]);

        return step(adPipelineContext(), [singleSlot]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit1, adUnit2]);
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
        const adUnit2 = prebidAdUnit(
          domId,
          [{ bidder: 'appnexus', params: { placementId: '124' } }],
          []
        );
        const singleSlot = createSlotDefinitions(domId, () => [
          { adUnit: adUnit1 },
          { adUnit: adUnit2 }
        ]);

        return step(adPipelineContext(), [singleSlot]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit1]);
        });
      });
    });
  });

  describe('prebid request bids', () => {
    const prebidConfig: Moli.headerbidding.PrebidConfig = {
      config: pbjsTestConfig
    };

    it('should not call requestBids if slots are empty', async () => {
      const requestBidsSpy = sandbox.spy(dom.window.pbjs, 'requestBids');
      const step = prebidRequestBids(prebidConfig, undefined);

      await step(adPipelineContext(), []);
      expect(requestBidsSpy).to.have.not.been.called;
    });

    it('should not call requestBids if all slots are filtered', async () => {
      const requestBidsSpy = sandbox.spy(dom.window.pbjs, 'requestBids');
      const step = prebidRequestBids(prebidConfig, undefined);
      const slot = createAdSlot('none-prebid');

      await step(adPipelineContext(), [
        {
          moliSlot: slot,
          adSlot: googleAdSlotStub(slot.adUnitPath, slot.domId),
          filterSupportedSizes: sizes => sizes
        }
      ]);
      expect(requestBidsSpy).to.have.not.been.called;
    });

    it('should call requestBids with the ad unit code', async () => {
      const requestBidsSpy = sandbox.spy(dom.window.pbjs, 'requestBids');
      const step = prebidRequestBids(prebidConfig, undefined);

      const domId = 'prebid-slot';
      const adUnit = prebidAdUnit(domId, [
        { bidder: 'appnexus', params: { placementId: '123' }, labelAll: ['mobile'] }
      ]);
      const slotDef = createSlotDefinitions(domId, { adUnit });

      await step(adPipelineContext(), [slotDef]);
      expect(requestBidsSpy).to.have.been.calledOnce;
      expect(requestBidsSpy).to.have.been.calledWith(
        Sinon.match.has('adUnitCodes', Sinon.match.array.deepEquals([domId]))
      );
      expect(requestBidsSpy).to.have.been.calledWith(
        Sinon.match.has('bidsBackHandler', Sinon.match.func)
      );
    });
  });
});
