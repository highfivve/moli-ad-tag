import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { Moli } from '../types/moli';
import { prebidjs } from '../types/prebidjs';

import { emptyConfig, noopLogger } from '../stubs/moliStubs';
import { AdPipelineContext } from './adPipeline';
import { prebidConfigure, prebidPrepareRequestAds, prebidRequestBids } from './prebid';
import { noopReportingService } from './reportingService';
import { LabelConfigService } from './labelConfigService';
import { createPbjsStub, pbjsTestConfig, moliPrebidTestConfig } from '../stubs/prebidjsStubs';
import { googleAdSlotStub } from '../stubs/googletagStubs';
import { tcData } from '../stubs/consentStubs';
import { googletag } from '../types/googletag';
import PrebidAdSlotContext = Moli.headerbidding.PrebidAdSlotContext;
import video = prebidjs.video;
import { dummySchainConfig } from '../stubs/schainStubs';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('prebid', () => {
  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const dom = createDom();
  const jsDomWindow: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow =
    dom.window as any;

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
  ): Moli.AdSlot => {
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
    sizes: [number, number][] = mediumRec,
    floors?: prebidjs.floors.IFloorsData
  ): prebidjs.IAdUnit => {
    return {
      code: domId,
      mediaTypes: {
        banner: { sizes }
      },
      bids: bids,
      ...floors
    };
  };

  const floors = (
    floorPrice: number,
    currency: prebidjs.currency.ICurrency = 'EUR',
    schemaDelimiter: string = '|',
    schemaFields: prebidjs.floors.IFloorSchemaFields[] = ['mediaType']
  ): prebidjs.floors.IFloorsData => {
    return {
      currency: currency,
      schema: { delimiter: schemaDelimiter, fields: schemaFields },
      values: { '*': floorPrice }
    };
  };

  const prebidVideoAdUnit = (
    domId: string,
    bids: prebidjs.IBid[],
    sizes: [number, number][] | [number, number] = mediumRec,
    w?: number,
    h?: number
  ): prebidjs.IAdUnit => {
    return {
      code: domId,
      mediaTypes: {
        video: {
          context: 'outstream',
          playerSize: sizes,
          mimes: ['video/mp4', 'video/MPV', 'video/H264', 'video/webm', 'video/ogg'],
          minduration: 1,
          maxduration: 30,
          playbackmethod: [
            video.PlaybackMethod.AutoPlaySoundOff,
            video.PlaybackMethod.ClickToPlay,
            video.PlaybackMethod.MousOver,
            video.PlaybackMethod.InViewportSoundsOff,
            video.PlaybackMethod.InViewportSoundsOn
          ],
          placement: video.Placement.InBanner,
          api: [
            video.Api.VPAID_1,
            video.Api.VPAID_2,
            video.Api.MRAID_1,
            video.Api.MRAID_2,
            video.Api.MRAID_3,
            video.Api.ORMMA
          ],
          protocols: [
            video.Protocol.VAST_1,
            video.Protocol.VAST_1_WRAPPER,
            video.Protocol.VAST_2,
            video.Protocol.VAST_2_WRAPPER,
            video.Protocol.VAST_3,
            video.Protocol.VAST_3_WRAPPER,
            video.Protocol.VAST_4,
            video.Protocol.VAST_4_WRAPPER
          ],
          skip: video.Skip.YES,
          startdelay: 1,
          w,
          h
        }
      },
      bids: bids
    };
  };

  const createSlotDefinitions = (
    domId: string,
    provider: Moli.headerbidding.PrebidAdSlotConfigProvider,
    floorprice?: number
  ): Moli.SlotDefinition => {
    const slot = prebidSlot(domId, provider);
    return {
      moliSlot: slot,
      adSlot: googleAdSlotStub(slot.adUnitPath, slot.domId),
      filterSupportedSizes: sizes => sizes,
      priceRule: floorprice ? { priceRuleId: 1, floorprice: floorprice, main: true } : undefined
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
      const step = prebidConfigure(moliPrebidTestConfig, dummySchainConfig);
      const setConfigSpy = sandbox.spy(dom.window.pbjs, 'setConfig');

      return step(adPipelineContext(), []).then(() => {
        expect(setConfigSpy).to.have.been.calledOnce;
        expect(setConfigSpy).to.have.been.calledOnceWithExactly({
          ...pbjsTestConfig,
          ...{
            schain: {
              validation: 'relaxed',
              config: {
                ver: '1.0',
                complete: 1,
                nodes: [dummySchainConfig.supplyChainStartNode]
              }
            }
          }
        });
      });
    });
  });

  describe('prebid prepare request ads', () => {
    it('should add empty adunits array when the slots array is empty', () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
      const step = prebidPrepareRequestAds(moliPrebidTestConfig);

      return step(adPipelineContext(), []).then(() => {
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([]);
      });
    });

    it('should use the code property if set', async () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
      const step = prebidPrepareRequestAds(moliPrebidTestConfig);

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
      const step = prebidPrepareRequestAds(moliPrebidTestConfig);

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

    describe('prebid adslot context', () => {
      const stubPrebidAdSlotConfigProvider = (domId: string) => {
        return sandbox.stub().returns({
          adUnit: prebidAdUnit(domId, [
            { bidder: 'appnexus', params: { placementId: '123' }, labelAll: ['mobile'] }
          ])
        });
      };

      it('should have isMobile true if labels are empty', async () => {
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);
        const domId = getDomId();
        const provider = stubPrebidAdSlotConfigProvider(domId);
        const singleSlot = createSlotDefinitions(domId, provider);

        await step(adPipelineContext(), [singleSlot]);
        expect(provider).to.have.been.calledOnce;
        const context: PrebidAdSlotContext = provider.firstCall.firstArg;
        expect(context.labels).to.be.empty;
        expect(context.isMobile).to.be.true;
      });

      it('should have isMobile false if labels contains desktop', async () => {
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);
        const domId = getDomId();
        const provider = stubPrebidAdSlotConfigProvider(domId);
        const singleSlot = createSlotDefinitions(domId, provider);

        const pipelineContext = adPipelineContext();
        sandbox.stub(pipelineContext.labelConfigService, 'getSupportedLabels').returns(['desktop']);

        await step(pipelineContext, [singleSlot]);
        expect(provider).to.have.been.calledOnce;
        const context: PrebidAdSlotContext = provider.firstCall.firstArg;
        expect(context.labels).contains('desktop');
        expect(context.isMobile).to.be.false;
      });
    });

    describe('labels', () => {
      it('should remove labelAll', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

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
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

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
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const singleSlot = createSlotDefinitions(domId, []);

        return step(adPipelineContext(), [singleSlot]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([]);
        });
      });

      it('should add a single adunit when the static prebid config provider returns a single bid', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

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
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

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
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

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
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

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
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const singleSlot = createSlotDefinitions(domId, () => []);

        return step(adPipelineContext(), [singleSlot]).then(() => {
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([]);
        });
      });

      it('should add a single adunit when the dynamic prebid config provider returns a single bid', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

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
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

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
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

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
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

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

    describe('resolve adUnitPathVariables', () => {
      const ctxWithLabelServiceStub = adPipelineContext();
      const getSupportedLabelsStub = sandbox.stub(
        ctxWithLabelServiceStub.labelConfigService,
        'getSupportedLabels'
      );

      it('should resolve the stored request id with the correct apex domain of the site', async () => {
        const exampleDeviceLabel = 'mobile';
        getSupportedLabelsStub.returns([exampleDeviceLabel]);

        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);
        const domId = getDomId();
        const adUnit = {
          ...prebidAdUnit(domId, [{ bidder: 'appnexus', params: { placementId: '123' } }])
        };

        // create a slot with a custom storedrequest id
        const slot = createSlotDefinitions(domId, { adUnit });
        const singleSlot: Moli.SlotDefinition<Moli.AdSlot> = {
          ...slot,
          moliSlot: {
            ...slot.moliSlot,
            prebid: {
              ...slot.moliSlot.prebid,
              adUnit: {
                ...adUnit,
                ortb2Imp: {
                  ext: {
                    prebid: {
                      storedrequest: { id: `/123/${domId}/{device}/{domain}` }
                    }
                  }
                }
              }
            }
          }
        };

        await step(ctxWithLabelServiceStub, [singleSlot]);
        // check that the storedrequest id is properly resolved
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([
          {
            ...adUnit,
            ortb2Imp: {
              ext: {
                prebid: {
                  storedrequest: { id: `/123/${domId}/${exampleDeviceLabel}/localhost` }
                }
              }
            }
          }
        ]);
      });

      ['desktop', 'mobile'].forEach(deviceLabel => {
        it(`should resolve an existing adUnitPath with the appropriate device label ${deviceLabel}`, async () => {
          getSupportedLabelsStub.returns([deviceLabel]);
          const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
          const step = prebidPrepareRequestAds(moliPrebidTestConfig);
          const domId = getDomId();
          const adUnitPath = `/123/${domId}/{device}`;
          const adUnit = {
            ...prebidAdUnit(domId, [{ bidder: 'appnexus', params: { placementId: '123' } }]),
            pubstack: {
              adUnitName: 'content_1',
              adUnitPath: adUnitPath
            }
          };
          // create a slot with a custom adUnitPath
          const slot = createSlotDefinitions(domId, { adUnit });
          const singleSlot: Moli.SlotDefinition<Moli.AdSlot> = {
            ...slot,
            moliSlot: {
              ...slot.moliSlot,
              adUnitPath: adUnitPath
            }
          };

          await step(ctxWithLabelServiceStub, [singleSlot]);
          // check that the pubstack adUnitPath is properly resolved and adUnitName is preserved
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([
            {
              ...adUnit,
              pubstack: {
                adUnitName: 'content_1',
                adUnitPath: `/123/${domId}/${deviceLabel}`
              }
            }
          ]);
        });

        it(`should resolve adUnitPath with the appropriate device label ${deviceLabel}`, async () => {
          getSupportedLabelsStub.returns([deviceLabel]);

          const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
          const step = prebidPrepareRequestAds(moliPrebidTestConfig);
          const domId = getDomId();
          const adUnit = {
            ...prebidAdUnit(domId, [{ bidder: 'appnexus', params: { placementId: '123' } }]),
            pubstack: {
              adUnitName: 'content_1'
            }
          };
          // create a slot with a custom adUnitPath
          const slot = createSlotDefinitions(domId, { adUnit });
          const singleSlot: Moli.SlotDefinition<Moli.AdSlot> = {
            ...slot,
            moliSlot: {
              ...slot.moliSlot,
              adUnitPath: `/123/${domId}/{device}`
            }
          };

          await step(ctxWithLabelServiceStub, [singleSlot]);
          // check that the pubstack adUnitPath is properly resolved and adUnitName is preserved
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([
            {
              ...adUnit,
              pubstack: {
                adUnitName: 'content_1',
                adUnitPath: `/123/${domId}/${deviceLabel}`
              }
            }
          ]);
        });
      });
    });
    describe('video playerSize consolidation', () => {
      it('should set playerSize = undefined if no video sizes are given', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const adUnit = {
          ...prebidVideoAdUnit(domId, [{ bidder: 'appnexus', params: { placementId: '123' } }], [])
        };
        const singleSlot = createSlotDefinitions(domId, { adUnit });

        await step(adPipelineContext(), [singleSlot]);
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([
          {
            ...adUnit,
            mediaTypes: {
              video: { ...adUnit.mediaTypes.video, playerSize: undefined }
            }
          }
        ]);
      });

      it('should set playerSize and w+h properties from a single size', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const adUnit = {
          ...prebidVideoAdUnit(
            domId,
            [{ bidder: 'appnexus', params: { placementId: '123' } }],
            [300, 250]
          )
        };
        const singleSlot = createSlotDefinitions(domId, { adUnit });

        await step(adPipelineContext(), [singleSlot]);
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([
          {
            ...adUnit,
            mediaTypes: {
              video: { ...adUnit.mediaTypes.video, playerSize: [[300, 250]], w: 300, h: 250 }
            }
          }
        ]);
      });

      it('should set playerSize and w+h properties from multiple sizes', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const adUnit = {
          ...prebidVideoAdUnit(
            domId,
            [{ bidder: 'appnexus', params: { placementId: '123' } }],
            [
              [300, 250],
              [605, 340]
            ]
          )
        };
        const singleSlot = createSlotDefinitions(domId, { adUnit });

        await step(adPipelineContext(), [singleSlot]);
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([
          {
            ...adUnit,
            mediaTypes: {
              video: { ...adUnit.mediaTypes.video, w: 300, h: 250 }
            }
          }
        ]);
      });

      it('should not overwrite w+h properties if set in adUnit', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const adUnit = {
          ...prebidVideoAdUnit(
            domId,
            [{ bidder: 'appnexus', params: { placementId: '123' } }],
            [
              [300, 250],
              [605, 340]
            ],
            1000,
            1000
          )
        };
        const singleSlot = createSlotDefinitions(domId, { adUnit });

        await step(adPipelineContext(), [singleSlot]);
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([
          {
            ...adUnit,
            mediaTypes: {
              video: { ...adUnit.mediaTypes.video, w: 1000, h: 1000 }
            }
          }
        ]);
      });
    });
    describe('floors', () => {
      it('should not be filled if priceRule is not set', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

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

      it('should be filled if priceRule is set', () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const adUnit = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' }, labelAny: ['mobile'] }
        ]);
        const singleSlot = createSlotDefinitions(domId, { adUnit }, 0.2);

        return step(adPipelineContext(), [singleSlot]).then(() => {
          const expectedAdUnit: prebidjs.IAdUnit = {
            ...adUnit,
            bids: [{ bidder: 'appnexus', params: { placementId: '123' } }],
            floors: floors(0.2)
          };
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([expectedAdUnit]);
        });
      });
    });
  });

  describe('prebid request bids', () => {
    it('should not call requestBids if slots are empty', async () => {
      const requestBidsSpy = sandbox.spy(dom.window.pbjs, 'requestBids');
      const step = prebidRequestBids(moliPrebidTestConfig, 'gam', undefined);

      await step(adPipelineContext(), []);
      expect(requestBidsSpy).to.have.not.been.called;
    });

    it('should not call requestBids if all slots are filtered', async () => {
      const requestBidsSpy = sandbox.spy(dom.window.pbjs, 'requestBids');
      const step = prebidRequestBids(moliPrebidTestConfig, 'gam', undefined);
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
      const step = prebidRequestBids(moliPrebidTestConfig, 'gam', undefined);

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

    it('should call requestBids with the timeout in adPipeline context', async () => {
      const requestBidsSpy = sandbox.spy(dom.window.pbjs, 'requestBids');
      const step = prebidRequestBids(moliPrebidTestConfig, 'gam', undefined);

      const domId = 'prebid-slot';
      const adUnit = prebidAdUnit(domId, [
        { bidder: 'appnexus', params: { placementId: '123' }, labelAll: ['mobile'] }
      ]);
      const slotDef = createSlotDefinitions(domId, { adUnit });

      await step({ ...adPipelineContext(), bucket: { timeout: 3000 } }, [slotDef]);
      expect(requestBidsSpy).to.have.been.calledOnce;
      expect(requestBidsSpy).to.have.been.calledWith(Sinon.match.has('timeout', 3000));
    });
  });
});
