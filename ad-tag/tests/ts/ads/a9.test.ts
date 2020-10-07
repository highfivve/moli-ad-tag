import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { Moli } from '../../../source/ts/types/moli';

import { emptyConfig, noopLogger } from '../stubs/moliStubs';
import { AdPipelineContext } from '../../../source/ts/ads/adPipeline';
import { SlotEventService } from '../../../source/ts/ads/slotEventService';
import { noopReportingService } from '../../../source/ts/ads/reportingService';
import { LabelConfigService } from '../../../source/ts/ads/labelConfigService';
import { googleAdSlotStub } from '../stubs/googletagStubs';
import { a9ConfigStub, apstagStub } from '../stubs/a9Stubs';
import { a9Configure, a9RequestBids } from '../../../source/ts/ads/a9';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

// tslint:disable: no-unused-expression
describe('a9', () => {
  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const dom = createDom();
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
      window: dom.window,
      labelConfigService: new LabelConfigService([], [], dom.window),
      reportingService: noopReportingService,
      slotEventService: new SlotEventService(noopLogger)
    };
  };

  let domIdCounter: number = 0;
  const mediumRec: [number, number][] = [[300, 250]];

  const getDomId = (): string => {
    domIdCounter = domIdCounter + 1;
    return `dom-id-${domIdCounter}`;
  };

  const a9Slot = (domId: string, a9: Moli.headerbidding.A9AdSlotConfig): Moli.A9AdSlot => {
    domIdCounter = domIdCounter + 1;
    return {
      domId: domId,
      adUnitPath: `/123/${domId}`,
      sizes: mediumRec,
      position: 'in-page',
      sizeConfig: [],
      behaviour: { loaded: 'eager' },
      a9: a9
    };
  };

  const createSlotDefinitions = (
    domId: string,
    provider: Moli.headerbidding.A9AdSlotConfig
  ): Moli.SlotDefinition => {
    const slot = a9Slot(domId, provider);
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
    dom.window.apstag = apstagStub;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('prebid configure step', () => {
    it('should set the prebid config', () => {
      const step = a9Configure(a9ConfigStub);
      const setConfigSpy = sandbox.spy(dom.window.apstag, 'init');

      return step(adPipelineContext(), []).then(() => {
        expect(setConfigSpy).to.have.been.calledOnce;
        expect(setConfigSpy).to.have.been.calledOnceWithExactly({
          pubID: a9ConfigStub.pubID,
          adServer: 'googletag',
          bidTimeout: a9ConfigStub.timeout,
          gdpr: {
            cmpTimeout: a9ConfigStub.cmpTimeout
          }
        });
      });
    });
  });

  describe('prebid prepare request ads', () => {
    it('should add empty adunits array when the slots array is empty', () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
      const step = a9RequestBids();

      return step(adPipelineContext(), []).then(() => {
        expect(addAdUnitsSpy).not.to.have.been.called;
      });
    });

    it('should request for the wandted ad slot', () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
      const step = a9RequestBids();

      const domId = getDomId();
      const singleSlot = createSlotDefinitions(domId, {});

      return step(adPipelineContext(), [singleSlot]).then(() => {
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly(
          {
            slots: [
              {
                slotID: domId,
                slotName: singleSlot.adSlot.getAdUnitPath(),
                sizes: mediumRec
              }
            ]
          },
          Sinon.match.func
        );
      });
    });

    it('should return mediaType video when wanted', () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
      const step = a9RequestBids();

      const domId = getDomId();
      const singleSlot = createSlotDefinitions(domId, {
        mediaType: 'video'
      });

      return step(adPipelineContext(), [singleSlot]).then(() => {
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly(
          {
            slots: [
              {
                slotID: domId,
                mediaType: 'video'
              }
            ]
          },
          Sinon.match.func
        );
      });
    });

    it('should return video and display slots', () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
      const step = a9RequestBids();

      const displayDomId = getDomId();
      const displaySlot = createSlotDefinitions(displayDomId, {});

      const videoDomId = getDomId();
      const videoSlot = createSlotDefinitions(videoDomId, {
        mediaType: 'video'
      });

      return step(adPipelineContext(), [displaySlot, videoSlot]).then(() => {
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly(
          {
            slots: [
              {
                slotID: displayDomId,
                slotName: displaySlot.adSlot.getAdUnitPath(),
                sizes: mediumRec
              },
              {
                slotID: videoDomId,
                mediaType: 'video'
              }
            ]
          },
          Sinon.match.func
        );
      });
    });
  });
});
