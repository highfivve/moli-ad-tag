import { createDomAndWindow } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { MoliRuntime } from '../types/moliRuntime';
import { prebidjs } from '../types/prebidjs';

import { emptyConfig, emptyRuntimeConfig, noopLogger } from '../stubs/moliStubs';
import { AdPipelineContext } from './adPipeline';
import {
  prebidConfigure,
  prebidInit,
  prebidPrepareRequestAds,
  prebidRemoveAdUnits,
  prebidRequestBids
} from './prebid';
import { createLabelConfigService } from './labelConfigService';
import { createPbjsStub, moliPrebidTestConfig, pbjsTestConfig } from '../stubs/prebidjsStubs';
import { googleAdSlotStub } from '../stubs/googletagStubs';
import { tcData } from '../stubs/consentStubs';
import { dummySchainConfig } from '../stubs/schainStubs';
import { createGlobalAuctionContext } from './globalAuctionContext';
import { AdSlot, Environment, headerbidding, MoliConfig } from '../types/moliConfig';
import { createAssetLoaderService } from '../util/assetLoaderService';
import { packageJson } from 'ad-tag/gen/packageJson';
import { createEventService } from 'ad-tag/ads/eventService';
import video = prebidjs.video;

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('prebid', () => {
  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const { dom, jsDomWindow } = createDomAndWindow();

  const assetLoaderService = createAssetLoaderService(jsDomWindow);

  const adPipelineContext = (
    env: Environment = 'production',
    config: MoliConfig = emptyConfig,
    requestAdsCalls: number = 1
  ): AdPipelineContext => {
    return {
      auctionId__: 'xxxx-xxxx-xxxx-xxxx',
      requestId__: 0,
      requestAdsCalls__: requestAdsCalls,
      env__: env,
      logger__: noopLogger,
      config__: config,
      runtimeConfig__: emptyRuntimeConfig,
      window__: jsDomWindow,
      labelConfigService__: createLabelConfigService([], [], jsDomWindow),
      tcData__: tcData,
      adUnitPathVariables__: { domain: 'example.com', device: 'mobile' },
      auction__: createGlobalAuctionContext(jsDomWindow, noopLogger, createEventService(), {
        biddersDisabling: {
          enabled: true,
          minRate: 0.2,
          minBidRequests: 1,
          reactivationPeriod: 1000
        }
      }),
      assetLoaderService__: assetLoaderService
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
    provider: headerbidding.PrebidAdSlotConfigProvider
  ): AdSlot => {
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

  const createAdSlot = (domId: string): AdSlot => {
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
          plcmt: video.Plcmt.NoContentStandalone,
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
    provider: headerbidding.PrebidAdSlotConfigProvider,
    floorprice?: number
  ): MoliRuntime.SlotDefinition => {
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
    sandbox.useFakeTimers();
  });

  afterEach(() => {
    sandbox.reset();
    sandbox.clock.restore();
  });

  describe('prebid init step', () => {
    const loadSpy = sandbox.spy(assetLoaderService, 'loadScript');

    it('should not load prebid externally if prebid was already loaded', async () => {
      dom.window.pbjs = { que: [], libLoaded: true };
      await prebidInit(assetLoaderService)(
        adPipelineContext(undefined, {
          ...emptyConfig,
          prebid: moliPrebidTestConfig
        })
      );
      expect(loadSpy).to.have.not.been.called;
    });

    it('should load prebid externally if prebid was not already loaded and distributionUrl is defined', async () => {
      dom.window.pbjs = { que: [] };
      await prebidInit(assetLoaderService)(
        adPipelineContext(undefined, {
          ...emptyConfig,
          prebid: moliPrebidTestConfig
        })
      );

      expect(loadSpy).to.have.be.been.calledOnceWithExactly({
        name: 'prebid',
        assetUrl: 'https://cdn.h5v.eu/prebid/dist/8.52.0/prebid.js',
        loadMethod: 1
      });
    });

    it('should enableAnalytics if the prebid config has it', async () => {
      const enableAnalyticsSpy = sandbox.spy(dom.window.pbjs, 'enableAnalytics');
      const analyticsAdapters: prebidjs.analytics.AnalyticsAdapter[] = [
        { provider: 'agma', options: { code: 'foo' } },
        { provider: 'ga', options: {} }
      ];
      await prebidInit(assetLoaderService)(
        adPipelineContext(undefined, {
          ...emptyConfig,
          prebid: {
            ...moliPrebidTestConfig,
            analyticAdapters: analyticsAdapters
          }
        })
      );
      expect(enableAnalyticsSpy).to.have.been.calledOnce;
      expect(enableAnalyticsSpy).to.have.been.calledOnceWithExactly(analyticsAdapters);
    });

    it('should not call enableAnalytics if the prebid config does not have it', async () => {
      const enableAnalyticsSpy = sandbox.spy(dom.window.pbjs, 'enableAnalytics');
      await prebidInit(assetLoaderService)(
        adPipelineContext(undefined, {
          ...emptyConfig,
          prebid: moliPrebidTestConfig
        })
      );
      expect(enableAnalyticsSpy).to.have.not.been.called;
    });
  });

  describe('prebid configure step', () => {
    it('should set the prebid config', async () => {
      const step = prebidConfigure(moliPrebidTestConfig, dummySchainConfig);
      const setConfigSpy = sandbox.spy(dom.window.pbjs, 'setConfig');

      await step(adPipelineContext(), []);
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

    describe('s2s config', () => {
      afterEach(() => {
        // remove any traces of moli
        (jsDomWindow as any).moli = undefined;
      });

      const testS2SConfig = (): prebidjs.server.S2SConfig => ({
        enabled: true,
        adapter: 'prebidServer',
        accountId: 'foo',
        bidders: ['appnexus'],
        timeout: 1000,
        endpoint: { p1Consent: '//server', noP1Consent: '//server' },
        syncEndpoint: { p1Consent: '//server', noP1Consent: '//server' }
      });

      const prebidConfigWithS2S = (
        s2sConfig: prebidjs.server.S2SConfig | ReadonlyArray<prebidjs.server.S2SConfig>
      ): headerbidding.PrebidConfig => ({
        ...moliPrebidTestConfig,
        config: { ...pbjsTestConfig, s2sConfig }
      });

      it('should not set prebid s2s config if none is defined', async () => {
        const step = prebidConfigure(moliPrebidTestConfig, dummySchainConfig);
        const setConfigSpy = sandbox.spy(dom.window.pbjs, 'setConfig');

        await step(adPipelineContext(), []);
        expect(setConfigSpy).to.have.been.calledOnce;
        const config: prebidjs.IPrebidJsConfig = setConfigSpy.firstCall.args[0];

        expect(config.s2sConfig).to.be.undefined;
      });

      it('should not set prebid s2s config with h5v analytics if the extPrebid property does not exist', async () => {
        const step = prebidConfigure(prebidConfigWithS2S(testS2SConfig()), dummySchainConfig);
        const setConfigSpy = sandbox.spy(dom.window.pbjs, 'setConfig');

        await step(adPipelineContext(), []);
        expect(setConfigSpy).to.have.been.calledOnce;
        const config: prebidjs.IPrebidJsConfig = setConfigSpy.firstCall.args[0];
        const s2sConfig = config.s2sConfig as prebidjs.server.S2SConfig;

        expect(s2sConfig).to.be.ok;
        expect(s2sConfig).to.be.an('object');
        expect(s2sConfig.extPrebid).to.be.undefined;
      });

      it('should set prebid s2s config with h5v analytics if the extPrebid property does exist', async () => {
        jsDomWindow.moli = {
          configLabel: 'staging'
        } as MoliRuntime.MoliTag;

        const step = prebidConfigure(
          prebidConfigWithS2S({
            ...testS2SConfig(),
            extPrebid: { analytics: { h5v: { moliVersion: 'foo' } } }
          }),
          dummySchainConfig
        );
        const setConfigSpy = sandbox.spy(dom.window.pbjs, 'setConfig');

        await step(adPipelineContext(), []);
        expect(setConfigSpy).to.have.been.calledOnce;
        const config: prebidjs.IPrebidJsConfig = setConfigSpy.firstCall.args[0];
        const s2sConfig = config.s2sConfig as prebidjs.server.S2SConfig;

        expect(s2sConfig).to.be.ok;
        expect(s2sConfig).to.be.an('object');
        expect(s2sConfig.extPrebid).to.be.ok;
        expect(s2sConfig.extPrebid?.analytics?.h5v.configLabel).to.be.eq('staging');
        expect(s2sConfig.extPrebid?.analytics?.h5v.moliVersion).to.be.eq(packageJson.version);
      });

      it('should set prebid s2s config with h5v analytics if s2s config is an array', async () => {
        jsDomWindow.moli = {
          configLabel: 'staging'
        } as MoliRuntime.MoliTag;

        const step = prebidConfigure(
          prebidConfigWithS2S([
            { ...testS2SConfig(), extPrebid: { analytics: { h5v: { moliVersion: 'foo' } } } }
          ]),
          dummySchainConfig
        );
        const setConfigSpy = sandbox.spy(dom.window.pbjs, 'setConfig');

        await step(adPipelineContext(), []);
        expect(setConfigSpy).to.have.been.calledOnce;
        const config: prebidjs.IPrebidJsConfig = setConfigSpy.firstCall.args[0];
        const s2sConfig = config.s2sConfig as prebidjs.server.S2SConfig[];

        expect(s2sConfig).to.be.ok;
        expect(s2sConfig).to.be.an('array');
        expect(s2sConfig[0].extPrebid).to.be.ok;
        expect(s2sConfig[0].extPrebid?.analytics?.h5v.configLabel).to.be.eq('staging');
        expect(s2sConfig[0].extPrebid?.analytics?.h5v.moliVersion).to.be.eq(packageJson.version);
      });
    });
  });

  describe('prebid prepare request ads', () => {
    it('should add empty adunits array when the slots array is empty', async () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
      const step = prebidPrepareRequestAds(moliPrebidTestConfig);
      await step(adPipelineContext(), []);
      expect(addAdUnitsSpy).to.have.been.calledOnce;
      expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([]);
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

    it('should add no adunits if ephemeralAdUnits is true ', async () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
      const step = prebidPrepareRequestAds({ ...moliPrebidTestConfig, ephemeralAdUnits: true });
      await step(adPipelineContext(), []);
      expect(addAdUnitsSpy).to.have.callCount(0);
    });

    describe('labels', () => {
      it('should remove labelAll', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const adUnit = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' }, labelAll: ['mobile'] }
        ]);
        const singleSlot = createSlotDefinitions(domId, { adUnit });

        await step(adPipelineContext(), [singleSlot]);
        const expectedAdUnit: prebidjs.IAdUnit = {
          ...adUnit,
          bids: [{ bidder: 'appnexus', params: { placementId: '123' } }]
        };
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([expectedAdUnit]);
      });

      it('should remove labelAny', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const adUnit = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' }, labelAny: ['mobile'] }
        ]);
        const singleSlot = createSlotDefinitions(domId, { adUnit });
        await step(adPipelineContext(), [singleSlot]);
        const expectedAdUnit: prebidjs.IAdUnit = {
          ...adUnit,
          bids: [{ bidder: 'appnexus', params: { placementId: '123' } }]
        };
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([expectedAdUnit]);
      });
    });

    describe('static ad slot config provider', () => {
      it('should add empty adunits array when the static prebid config provider is an empty array', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const singleSlot = createSlotDefinitions(domId, []);
        await step(adPipelineContext(), [singleSlot]);
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([]);
      });

      it('should add a single adunit when the static prebid config provider returns a single bid', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const adUnit = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' } }
        ]);
        const singleSlot = createSlotDefinitions(domId, { adUnit });
        await step(adPipelineContext(), [singleSlot]);
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit]);
      });

      it('should add a single adunit when the static prebid config provider returns a single bid array', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const adUnit = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' } }
        ]);
        const singleSlot = createSlotDefinitions(domId, [{ adUnit }]);
        await step(adPipelineContext(), [singleSlot]);
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit]);
      });

      it('should add a two adunits when the static prebid config provider returns a two bids', async () => {
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
        await step(adPipelineContext(), [singleSlot]);
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit1, adUnit2]);
      });

      it('should filter out bidders that are disabled in the auctionContext', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);
        const domId = getDomId();
        const adUnit1 = prebidAdUnit(domId, [
          { bidder: 'teads', params: { pageId: 123, placementId: 456 } },
          { bidder: 'appnexus', params: { placementId: '124' } }
        ]);

        const singleSlot = createSlotDefinitions(domId, [{ adUnit: adUnit1 }]);

        const ctx = adPipelineContext();
        const isBidderDisabledStub = sandbox.stub(ctx.auction__!, 'isBidderDisabled');

        isBidderDisabledStub.withArgs(domId, 'teads').returns(true);
        isBidderDisabledStub.withArgs(domId, 'appnexus').returns(false);

        await step(ctx, [singleSlot]);
        expect(isBidderDisabledStub).to.have.been.called;

        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([
          prebidAdUnit(domId, [{ bidder: 'appnexus', params: { placementId: '124' } }])
        ]);
      });

      it('should do nothing if auctionContext was defined but bidder is undefined', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);
        const domId = getDomId();
        const adUnit1 = prebidAdUnit(domId, [{ bidder: undefined } as any]);

        const singleSlot = createSlotDefinitions(domId, [{ adUnit: adUnit1 }]);

        const ctx = adPipelineContext();
        const isBidderDisabledSpy = sandbox.spy(ctx.auction__, 'isBidderDisabled');

        await step(ctx, [singleSlot]);
        expect(isBidderDisabledSpy).to.have.not.been.called;

        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit1]);
      });

      it('should add a single adunit when the static prebid config provider returns a two bids but one is filtered', async () => {
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
        await step(adPipelineContext(), [singleSlot]);
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit1]);
      });
    });

    describe('dynamic ad slot config provider', () => {
      it('should add empty adunits array when the dynamic prebid config provider is an empty array', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const singleSlot = createSlotDefinitions(domId, []);
        await step(adPipelineContext(), [singleSlot]);
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([]);
      });

      it('should add a single adunit when the dynamic prebid config provider returns a single bid', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const adUnit = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' } }
        ]);
        const singleSlot = createSlotDefinitions(domId, { adUnit });
        await step(adPipelineContext(), [singleSlot]);
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit]);
      });

      it('should add a single adunit when the dynamic prebid config provider returns a single bid array', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const adUnit = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' } }
        ]);
        const singleSlot = createSlotDefinitions(domId, [{ adUnit }]);
        await step(adPipelineContext(), [singleSlot]);
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit]);
      });

      it('should add a two adunits when the dynamic prebid config provider returns a two bids', async () => {
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
        await step(adPipelineContext(), [singleSlot]);
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit1, adUnit2]);
      });

      it('should add a single adunit when the dynamic prebid config provider returns a two bids but one is filtered', async () => {
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
        await step(adPipelineContext(), [singleSlot]);
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([adUnit1]);
      });
    });

    describe('resolve adUnitPathVariables', () => {
      const ctxWithAdUnitPathVars = (
        device: 'mobile' | 'desktop',
        domain: string
      ): AdPipelineContext => ({
        ...adPipelineContext(),
        adUnitPathVariables__: { domain: domain, device: device }
      });
      const domain = 'example.com';

      it('should resolve the stored request id with the correct apex domain of the site', async () => {
        const deviceLabelMobile = 'mobile';

        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);
        const domId = getDomId();
        const adUnit = {
          ...prebidAdUnit(domId, [{ bidder: 'appnexus', params: { placementId: '123' } }])
        };

        // create a slot with a custom storedrequest id
        const slot = createSlotDefinitions(domId, { adUnit });
        const singleSlot: MoliRuntime.SlotDefinition = {
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

        await step(ctxWithAdUnitPathVars('mobile', domain), [singleSlot]);
        // check that the storedrequest id is properly resolved
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([
          {
            ...adUnit,
            ortb2Imp: {
              ext: {
                prebid: {
                  storedrequest: { id: `/123/${domId}/${deviceLabelMobile}/${domain}` }
                }
              }
            }
          }
        ]);
      });

      ['desktop' as const, 'mobile' as const].forEach(deviceLabel => {
        it(`should resolve an existing adUnitPath with the appropriate device label ${deviceLabel}`, async () => {
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
          const singleSlot: MoliRuntime.SlotDefinition = {
            ...slot,
            moliSlot: {
              ...slot.moliSlot,
              adUnitPath: adUnitPath
            }
          };

          await step(ctxWithAdUnitPathVars(deviceLabel, domain), [singleSlot]);
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
          const singleSlot: MoliRuntime.SlotDefinition = {
            ...slot,
            moliSlot: {
              ...slot.moliSlot,
              adUnitPath: `/123/${domId}/{device}`
            }
          };

          await step(ctxWithAdUnitPathVars(deviceLabel, domain), [singleSlot]);
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
    describe('mediaType video', () => {
      describe('fallback renderer', async () => {
        it('should not add renderer if not configured in prebidConfig', async () => {
          const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
          const step = prebidPrepareRequestAds(moliPrebidTestConfig);

          const domId = getDomId();
          const adUnit = {
            ...prebidVideoAdUnit(
              domId,
              [{ bidder: 'appnexus', params: { placementId: '123' } }],
              []
            )
          };
          const singleSlot = createSlotDefinitions(domId, { adUnit });

          await step(adPipelineContext(), [singleSlot]);
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          const adUnitAdded = addAdUnitsSpy.firstCall.args[0][0] as prebidjs.IAdUnit;

          expect(adUnitAdded).to.have.property('mediaTypes');
          expect(adUnitAdded.mediaTypes).to.have.property('video');
          expect(adUnitAdded.mediaTypes.video).to.not.have.property('renderer');
        });

        it('should add renderer if configured in prebidConfig', async () => {
          const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
          const step = prebidPrepareRequestAds({
            ...moliPrebidTestConfig,
            backupVideoRenderer: {
              url: 'https://example.com/fallback.js'
            }
          });

          const domId = getDomId();
          const adUnit = {
            ...prebidVideoAdUnit(
              domId,
              [{ bidder: 'appnexus', params: { placementId: '123' } }],
              []
            )
          };
          const singleSlot = createSlotDefinitions(domId, { adUnit });

          await step(adPipelineContext(), [singleSlot]);
          expect(addAdUnitsSpy).to.have.been.calledOnce;
          const adUnitAdded = addAdUnitsSpy.firstCall.args[0][0] as prebidjs.IAdUnit;

          expect(adUnitAdded).to.have.property('mediaTypes');
          expect(adUnitAdded.mediaTypes).to.have.property('video');
          expect(adUnitAdded.mediaTypes.video).to.have.property('renderer');
          expect(adUnitAdded.mediaTypes.video?.renderer).to.have.property('url');
          expect(adUnitAdded.mediaTypes.video?.renderer?.url).to.be.eq(
            'https://example.com/fallback.js'
          );
        });
      });

      describe('video playerSize consolidation', () => {
        it('should set playerSize = undefined if no video sizes are given', async () => {
          const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
          const step = prebidPrepareRequestAds(moliPrebidTestConfig);

          const domId = getDomId();
          const adUnit = {
            ...prebidVideoAdUnit(
              domId,
              [{ bidder: 'appnexus', params: { placementId: '123' } }],
              []
            )
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
    });

    describe('floors', () => {
      it('should not be filled if priceRule is not set', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const adUnit = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' }, labelAny: ['mobile'] }
        ]);
        const singleSlot = createSlotDefinitions(domId, { adUnit });

        await step(adPipelineContext(), [singleSlot]);
        const expectedAdUnit: prebidjs.IAdUnit = {
          ...adUnit,
          bids: [{ bidder: 'appnexus', params: { placementId: '123' } }]
        };
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly([expectedAdUnit]);
      });

      it('should be filled if priceRule is set', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.pbjs, 'addAdUnits');
        const step = prebidPrepareRequestAds(moliPrebidTestConfig);

        const domId = getDomId();
        const adUnit = prebidAdUnit(domId, [
          { bidder: 'appnexus', params: { placementId: '123' }, labelAny: ['mobile'] }
        ]);
        const singleSlot = createSlotDefinitions(domId, { adUnit }, 0.2);

        await step(adPipelineContext(), [singleSlot]);
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

  describe('prebidRemoveAdUnits', () => {
    const adUnit1Slot = createAdSlot('adUnit1');

    beforeEach(() => {
      // add some dummy data
      dom.window.pbjs.adUnits = [{ code: adUnit1Slot.domId }];
    });
    afterEach(() => {
      // clean up adUnits property
      delete dom.window.pbjs.adUnits;
    });

    it('should call pbjs.removeAdUnit with the adUnitCode', async () => {
      const removeAdUnitSpy = sandbox.spy(dom.window.pbjs, 'removeAdUnit');

      const step = prebidRemoveAdUnits(moliPrebidTestConfig);

      await step(adPipelineContext(), [adUnit1Slot]);
      expect(removeAdUnitSpy).to.have.been.calledOnce;
      expect(removeAdUnitSpy).to.have.been.calledOnceWithExactly(adUnit1Slot.domId);
    });

    it('should not call pbjs.removeAdUnit with the adUnitCode if ephemeralAdUnits is true', async () => {
      const removeAdUnitSpy = sandbox.spy(dom.window.pbjs, 'removeAdUnit');
      const step = prebidRemoveAdUnits({ ...moliPrebidTestConfig, ephemeralAdUnits: true });

      await step(adPipelineContext(), [adUnit1Slot]);
      expect(removeAdUnitSpy).to.has.callCount(0);
    });
  });

  describe('prebid request bids', () => {
    const domId1 = 'prebid-slot-1';
    const domId2 = 'prebid-slot-2';
    const adUnit1 = prebidAdUnit(domId1, [
      { bidder: 'appnexus', params: { placementId: '123' }, labelAll: ['mobile'] },
      { bidder: 'orbidder', params: { accountId: 'foo', placementId: '123' }, labelAll: ['mobile'] }
    ]);
    const adUnit2 = prebidAdUnit(domId1, [
      { bidder: 'appnexus', params: { placementId: '456' }, labelAll: ['mobile'] }
    ]);

    const slotDef1 = createSlotDefinitions(domId1, { adUnit: adUnit1 });
    const slotDef2 = createSlotDefinitions(domId2, { adUnit: adUnit2 });

    it('should not call requestBids if slots are empty', async () => {
      const requestBidsSpy = sandbox.spy(dom.window.pbjs, 'requestBids');
      const step = prebidRequestBids(moliPrebidTestConfig, 'gam');

      await step(adPipelineContext(), []);
      expect(requestBidsSpy).to.have.not.been.called;
    });

    it('should not call requestBids if all slots are filtered', async () => {
      const requestBidsSpy = sandbox.spy(dom.window.pbjs, 'requestBids');
      const step = prebidRequestBids(moliPrebidTestConfig, 'gam');
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

    it('should not call requestBids if all slots are throttled', async () => {
      const requestBidsSpy = sandbox.spy(dom.window.pbjs, 'requestBids');
      const step = prebidRequestBids(moliPrebidTestConfig, 'gam');
      const slot = createAdSlot('none-prebid');
      const ctx = adPipelineContext();
      const isThrottledStub = sandbox.stub(ctx.auction__, 'isSlotThrottled');
      isThrottledStub.withArgs(slot.domId, slot.adUnitPath).returns(true);

      await step(ctx, [
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
      const step = prebidRequestBids(moliPrebidTestConfig, 'gam');

      const slotDef = createSlotDefinitions(domId1, { adUnit: adUnit1 });

      await step(adPipelineContext(), [slotDef]);
      expect(requestBidsSpy).to.have.been.calledOnce;
      expect(requestBidsSpy).to.have.been.calledWith(
        Sinon.match.has('adUnitCodes', Sinon.match.array.deepEquals([domId1]))
      );
      expect(requestBidsSpy).to.have.been.calledWith(
        Sinon.match.has('bidsBackHandler', Sinon.match.func)
      );
    });

    it('should call requestBids with ad unit codes that are not throttled', async () => {
      const requestBidsSpy = sandbox.spy(dom.window.pbjs, 'requestBids');
      const step = prebidRequestBids(moliPrebidTestConfig, 'gam');

      const slotDef1 = createSlotDefinitions(domId1, { adUnit: adUnit1 });
      const slotDef2 = createSlotDefinitions(domId2, { adUnit: adUnit2 });

      const ctx = adPipelineContext();
      const isThrottledStub = sandbox.stub(ctx.auction__, 'isSlotThrottled');
      isThrottledStub.withArgs(domId1, slotDef1.adSlot.getAdUnitPath()).returns(false);
      isThrottledStub.withArgs(domId2, slotDef2.adSlot.getAdUnitPath()).returns(true);

      await step(ctx, [slotDef1, slotDef2]);
      expect(requestBidsSpy).to.have.been.calledOnce;
      expect(requestBidsSpy).to.have.been.calledWith(
        Sinon.match.has('adUnitCodes', Sinon.match.array.deepEquals([domId1]))
      );
      expect(requestBidsSpy).to.have.been.calledWith(
        Sinon.match.has('bidsBackHandler', Sinon.match.func)
      );
    });

    it('should call requestBids with ad units that are not frequency capped', async () => {
      const requestBidsSpy = sandbox.spy(dom.window.pbjs, 'requestBids');
      const step = prebidRequestBids({ ...moliPrebidTestConfig, ephemeralAdUnits: true }, 'gam');

      const ctx = adPipelineContext();
      sandbox
        .stub(ctx.auction__, 'isBidderFrequencyCappedOnSlot')
        .withArgs(domId1, 'appnexus')
        .returns(false)
        .withArgs(domId1, 'orbidder')
        .returns(true);

      await step(ctx, [slotDef1]);
      expect(requestBidsSpy).to.have.been.calledOnce;
      const adUnits = requestBidsSpy.firstCall.args[0].adUnits;
      expect(adUnits).to.have.length(1);
      expect(adUnits[0]).to.deep.equals({
        ...adUnit1,
        // labelAll & labelAny are stripped away
        bids: [{ bidder: 'appnexus', params: { placementId: '123' } }]
      });
    });

    it('should call requestBids with ad units without bidders that are frequency capped', async () => {
      const requestBidsSpy = sandbox.spy(dom.window.pbjs, 'requestBids');
      const step = prebidRequestBids({ ...moliPrebidTestConfig, ephemeralAdUnits: true }, 'gam');

      const ctx = adPipelineContext();
      sandbox
        .stub(ctx.auction__, 'isBidderDisabled')
        .withArgs(domId1, 'appnexus')
        .returns(false)
        .withArgs(domId1, 'orbidder')
        .returns(true);

      await step(ctx, [slotDef1]);
      expect(requestBidsSpy).to.have.been.calledOnce;
      const adUnits = requestBidsSpy.firstCall.args[0].adUnits;
      expect(adUnits).to.have.length(1);
      expect(adUnits[0]).to.deep.equals({
        ...adUnit1,
        // labelAll & labelAny are stripped away
        bids: [{ bidder: 'appnexus', params: { placementId: '123' } }]
      });
    });

    it('should call requestBids with the prebid ad units if ephemeralAdUnits is true', async () => {
      const requestBidsSpy = sandbox.spy(dom.window.pbjs, 'requestBids');
      const step = prebidRequestBids({ ...moliPrebidTestConfig, ephemeralAdUnits: true }, 'gam');

      await step(adPipelineContext(), [slotDef1]);
      expect(requestBidsSpy).to.have.been.calledOnce;
      expect(requestBidsSpy).to.have.not.been.calledWith(
        Sinon.match.has('adUnitCodes', Sinon.match.array.deepEquals([domId1]))
      );
      expect(requestBidsSpy).to.have.been.calledWith(
        Sinon.match.has('bidsBackHandler', Sinon.match.func)
      );

      // validate the adUnits call - this gives better error messages than the Sinon.match calledWith
      const adUnits = requestBidsSpy.firstCall.args[0].adUnits;
      expect(adUnits).to.have.length(1);
      expect(adUnits[0]).to.deep.equals({
        ...adUnit1,
        // labelAll & labelAny are stripped away
        bids: [
          { bidder: 'appnexus', params: { placementId: '123' } },
          { bidder: 'orbidder', params: { accountId: 'foo', placementId: '123' } }
        ]
      });
    });

    it('should call requestBids with the prebid ad units if ephemeralAdUnits is true without throttled slots', async () => {
      const requestBidsSpy = sandbox.spy(dom.window.pbjs, 'requestBids');
      const step = prebidRequestBids({ ...moliPrebidTestConfig, ephemeralAdUnits: true }, 'gam');

      const ctx = adPipelineContext();
      sandbox
        .stub(ctx.auction__, 'isSlotThrottled')
        .withArgs(domId1, slotDef1.adSlot.getAdUnitPath())
        .returns(false)
        .withArgs(domId2, slotDef2.adSlot.getAdUnitPath())
        .returns(true);

      await step(ctx, [slotDef1, slotDef2]);
      expect(requestBidsSpy).to.have.been.calledOnce;
      expect(requestBidsSpy).to.have.not.been.calledWith(
        Sinon.match.has('adUnitCodes', Sinon.match.array.deepEquals([domId1]))
      );
      expect(requestBidsSpy).to.have.been.calledWith(
        Sinon.match.has('bidsBackHandler', Sinon.match.func)
      );

      // validate the adUnits call - this gives better error messages than the Sinon.match calledWith
      const adUnits = requestBidsSpy.firstCall.args[0].adUnits;
      expect(adUnits).to.have.length(1);
      expect(adUnits[0]).to.deep.equals({
        ...adUnit1,
        // labelAll & labelAny are stripped away
        bids: [
          { bidder: 'appnexus', params: { placementId: '123' } },
          { bidder: 'orbidder', params: { accountId: 'foo', placementId: '123' } }
        ]
      });
    });

    it('should call requestBids with the timeout in adPipeline context', async () => {
      const requestBidsSpy = sandbox.spy(dom.window.pbjs, 'requestBids');
      const step = prebidRequestBids(moliPrebidTestConfig, 'gam');

      const domId = 'prebid-slot';
      const adUnit = prebidAdUnit(domId, [
        { bidder: 'appnexus', params: { placementId: '123' }, labelAll: ['mobile'] }
      ]);
      const slotDef = createSlotDefinitions(domId, { adUnit });

      await step({ ...adPipelineContext(), bucket__: { timeout: 3000 } }, [slotDef]);
      expect(requestBidsSpy).to.have.been.calledOnce;
      expect(requestBidsSpy).to.have.been.calledWith(Sinon.match.has('timeout', 3000));
    });

    it('should resolve within the failsafe timeout', async () => {
      // do nothing when requestBids is called
      const requestBidsStub = sandbox.stub(dom.window.pbjs, 'requestBids');
      requestBidsStub.callsFake(() => {
        console.log('requestBids called');
      });
      const step = prebidRequestBids({ ...moliPrebidTestConfig, failsafeTimeout: 10000 }, 'gam');

      const domId = 'prebid-slot';
      const adUnit = prebidAdUnit(domId, [
        { bidder: 'appnexus', params: { placementId: '123' }, labelAll: ['mobile'] }
      ]);
      const slotDef = createSlotDefinitions(domId, { adUnit });
      const result = step(adPipelineContext(), [slotDef]);
      sandbox.clock.tick(10000);
      await result;
    });

    it('should resolve within the bidder timeout + buffer if the failsafe timeout is set too low', async () => {
      // do nothing when requestBids is called
      const requestBidsStub = sandbox.stub(dom.window.pbjs, 'requestBids');
      requestBidsStub.callsFake(() => {
        console.log('requestBids called');
      });
      const step = prebidRequestBids({ ...moliPrebidTestConfig, failsafeTimeout: 500 }, 'gam');

      const domId = 'prebid-slot';
      const adUnit = prebidAdUnit(domId, [
        { bidder: 'appnexus', params: { placementId: '123' }, labelAll: ['mobile'] }
      ]);
      const slotDef = createSlotDefinitions(domId, { adUnit });
      const result = step(adPipelineContext(), [slotDef]);

      // 500ms bidder timeout + 3000ms buffer
      sandbox.clock.tick(3500);
      await result;
    });
  });
});
