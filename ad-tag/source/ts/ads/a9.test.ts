import { createDomAndWindow } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import { MoliRuntime } from '../types/moliRuntime';

import {
  emptyConfig,
  emptyRuntimeConfig,
  newGlobalAuctionContext,
  noopLogger
} from '../stubs/moliStubs';
import { AdPipelineContext } from './adPipeline';
import { createLabelConfigService } from './labelConfigService';
import { googleAdSlotStub } from '../stubs/googletagStubs';
import { a9ConfigStub, apstagStub } from '../stubs/a9Stubs';
import { pbjsStub } from '../stubs/prebidjsStubs';
import {
  a9ClearTargetingStep,
  a9Configure,
  a9Init,
  a9PublisherAudiences,
  a9RequestBids
} from './a9';
import { fullConsent, tcData, tcDataNoGdpr, tcfapiFunction } from '../stubs/consentStubs';
import { googletag } from '../types/googletag';
import { createAssetLoaderService } from '../util/assetLoaderService';
import { tcfapi } from '../types/tcfapi';
import TCPurpose = tcfapi.responses.TCPurpose;
import EventStatus = tcfapi.status.EventStatus;
import { dummySchainConfig } from '../stubs/schainStubs';
import { AdSlot, Environment, headerbidding, MoliConfig } from '../types/moliConfig';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('a9', () => {
  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const { dom, jsDomWindow } = createDomAndWindow();
  const adPipelineContext = (
    env: Environment = 'production',
    config: MoliConfig = emptyConfig,
    requestAdsCalls: number = 1
  ): AdPipelineContext => {
    return {
      auctionId__: 'xxxx-xxxx-xxxx-xxxx',
      requestId__: 1,
      requestAdsCalls__: requestAdsCalls,
      env__: env,
      logger__: noopLogger,
      config__: config,
      runtimeConfig__: emptyRuntimeConfig,
      window__: jsDomWindow,
      labelConfigService__: createLabelConfigService([], [], jsDomWindow),
      tcData__: tcData,
      adUnitPathVariables__: { domain: 'example.com', device: 'mobile' },
      auction__: newGlobalAuctionContext(jsDomWindow),
      assetLoaderService__: createAssetLoaderService(jsDomWindow)
    };
  };

  let domIdCounter: number = 0;
  const mediumRec: [number, number][] = [
    [300, 250],
    [300, 200]
  ];

  const getDomId = (): string => {
    domIdCounter = domIdCounter + 1;
    return `dom-id-${domIdCounter}`;
  };

  const a9Slot = (domId: string, a9: headerbidding.A9AdSlotConfig): AdSlot => {
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
    provider: headerbidding.A9AdSlotConfig
  ): MoliRuntime.SlotDefinition => {
    const slot = a9Slot(domId, provider);
    return {
      moliSlot: slot,
      adSlot: googleAdSlotStub(slot.adUnitPath, slot.domId),
      filterSupportedSizes: sizes => sizes
    };
  };

  const contextWithConsent: AdPipelineContext = {
    ...adPipelineContext(),
    tcData__: fullConsent({ '793': true })
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

  describe('a9 init step', () => {
    let assetLoaderService = createAssetLoaderService(jsDomWindow);
    let assetLoaderStub = sandbox.stub(assetLoaderService, 'loadScript').resolves();

    beforeEach(() => {
      assetLoaderService = createAssetLoaderService(jsDomWindow);
      assetLoaderStub = sandbox.stub(assetLoaderService, 'loadScript').resolves();
    });

    it('should not load the a9 script in test mode', async () => {
      const step = a9Init(a9ConfigStub, assetLoaderService);
      const tcData = fullConsent({ '793': true });

      await step({ ...adPipelineContext('test'), tcData__: tcData });
      expect(assetLoaderStub).to.have.not.been.called;
    });

    it('should load the a9 script if consent is given', async () => {
      const step = a9Init(a9ConfigStub, assetLoaderService);
      const tcData = fullConsent({ '793': true });

      await step({ ...adPipelineContext(), tcData__: tcData });
      expect(assetLoaderStub).to.have.been.calledOnce;
    });

    it('should load the a9 script if gdpr does not apply', async () => {
      const step = a9Init(a9ConfigStub, assetLoaderService);

      await step({ ...adPipelineContext(), tcData__: tcDataNoGdpr });
      expect(assetLoaderStub).to.have.been.calledOnce;
    });

    it('should not load the a9 script if vendor consent is false', async () => {
      const step = a9Init(a9ConfigStub, assetLoaderService);
      const tcData = fullConsent({ '793': false });

      await step({ ...adPipelineContext(), tcData__: tcData });
      expect(assetLoaderStub).not.have.been.called;
    });

    it('should not load the a9 script if vendor consent is undefined', async () => {
      const step = a9Init(a9ConfigStub, assetLoaderService);

      await step(adPipelineContext());
      expect(assetLoaderStub).not.have.been.called;
    });

    [
      TCPurpose.STORE_INFORMATION_ON_DEVICE,
      TCPurpose.SELECT_BASIC_ADS,
      TCPurpose.CREATE_PERSONALISED_ADS_PROFILE,
      TCPurpose.SELECT_PERSONALISED_ADS,
      TCPurpose.MEASURE_AD_PERFORMANCE,
      TCPurpose.APPLY_MARKET_RESEARCH,
      TCPurpose.DEVELOP_IMPROVE_PRODUCTS
    ].forEach(purpose => {
      it(`should not load the a9 script if purpose ${purpose} is missing`, async () => {
        const step = a9Init(a9ConfigStub, assetLoaderService);
        const tcData = fullConsent({ '793': true });
        tcData.purpose.consents[purpose] = false;

        await step({ ...adPipelineContext(), tcData__: tcData });
        expect(assetLoaderStub).not.have.been.called;
      });
    });
  });

  describe('a9 configure step', () => {
    it('should set the a9 config', async () => {
      const step = a9Configure(a9ConfigStub, dummySchainConfig);
      const apstagInitSpy = sandbox.spy(dom.window.apstag, 'init');
      await step(adPipelineContext(), []);
      expect(apstagInitSpy).to.have.been.calledOnce;
      expect(apstagInitSpy).to.have.been.calledOnceWithExactly({
        pubID: a9ConfigStub.pubID,
        adServer: 'googletag',
        bidTimeout: a9ConfigStub.timeout,
        gdpr: {
          cmpTimeout: a9ConfigStub.cmpTimeout
        },
        schain: {
          complete: 1,
          ver: '1.0',
          nodes: [dummySchainConfig.supplyChainStartNode, a9ConfigStub.schainNode]
        }
      });
    });

    it('should add only the supplyChainStartNode if no schainNode is provided', async () => {
      const step = a9Configure({ ...a9ConfigStub, schainNode: undefined }, dummySchainConfig);
      const apstagInitSpy = sandbox.spy(dom.window.apstag, 'init');
      await step(adPipelineContext(), []);
      expect(apstagInitSpy).to.have.been.calledOnce;
      expect(apstagInitSpy).to.have.been.calledOnceWithExactly({
        pubID: a9ConfigStub.pubID,
        adServer: 'googletag',
        bidTimeout: a9ConfigStub.timeout,
        gdpr: {
          cmpTimeout: a9ConfigStub.cmpTimeout
        },
        schain: {
          complete: 1,
          ver: '1.0',
          nodes: [dummySchainConfig.supplyChainStartNode]
        }
      });
    });
  });

  describe('a9 publisher audiences step', () => {
    const a9Config = (
      publisherAudiencesConfig: headerbidding.A9PublisherAudienceConfig
    ): headerbidding.A9Config => {
      return {
        ...a9ConfigStub,
        publisherAudience: publisherAudiencesConfig
      };
    };

    beforeEach(() => {
      jsDomWindow.__tcfapi = tcfapiFunction;
    });

    it('should not call apstag.rpa if no config is provided', async () => {
      const step = a9PublisherAudiences(a9ConfigStub);
      const rpaSpy = sandbox.spy(dom.window.apstag, 'rpa');
      await step(adPipelineContext(), []);
      expect(rpaSpy).to.have.callCount(0);
    });

    it('should not call apstag.rpa if enabled is false', async () => {
      const step = a9PublisherAudiences(a9ConfigStub);
      const rpaSpy = sandbox.spy(dom.window.apstag, 'rpa');
      await step(adPipelineContext(), []);
      expect(rpaSpy).to.have.callCount(0);
    });

    it('should call apstag.rpa if enabled is true', async () => {
      const emailSHA = 'dc009fb060aaa34b467d072eecb0244b38d4b1a390f1f8fe7054a4b1df3fb05a';
      const step = a9PublisherAudiences(
        a9Config({
          enabled: true,
          sha256Email: emailSHA
        })
      );
      const rpaSpy = sandbox.spy(dom.window.apstag, 'rpa');
      await step(adPipelineContext(), []);
      expect(rpaSpy).to.have.been.calledOnce;
      expect(rpaSpy).to.have.been.calledOnceWithExactly({
        hashedRecords: [
          {
            type: 'email',
            record: emailSHA
          }
        ]
      });
    });

    it('should call apstag.upa on a consent change event', async () => {
      const emailSHA = 'dc009fb060aaa34b467d072eecb0244b38d4b1a390f1f8fe7054a4b1df3fb05a';
      const step = a9PublisherAudiences(
        a9Config({
          enabled: true,
          sha256Email: emailSHA
        })
      );
      const tcfapiStub = sandbox.stub();
      dom.window.__tcfapi = tcfapiStub;
      const upaSpy = sandbox.spy(dom.window.apstag, 'upa');
      await step(adPipelineContext(), []);
      expect(upaSpy).to.have.callCount(0);
      expect(tcfapiStub).to.have.been.calledOnce;

      // only update on user action complete
      const tcDataUserActionComplete: tcfapi.responses.TCDataWithGDPR = {
        ...fullConsent(),
        eventStatus: EventStatus.USER_ACTION_COMPLETE
      };

      // get callback function from stub
      const callback = tcfapiStub.firstCall.args[2];

      // First call should not trigger an update as this is callback is
      // always fired when an event listener is added
      callback(tcDataUserActionComplete);
      expect(upaSpy).to.have.callCount(0);

      // Actual change
      callback(tcDataUserActionComplete);
      expect(upaSpy).to.have.been.calledOnce;
      expect(upaSpy).to.have.been.calledOnceWithExactly({
        hashedRecords: [
          {
            type: 'email',
            record: emailSHA
          }
        ]
      });

      // No change if the ui is shown
      upaSpy.resetHistory();
      const tcDataUserCmpUiShown: tcfapi.responses.TCDataWithGDPR = {
        ...fullConsent(),
        eventStatus: EventStatus.CMP_UI_SHOWN
      };
      callback(tcDataUserCmpUiShown);
      expect(upaSpy).to.have.callCount(0);
    });
  });

  describe('a9 request bids step', () => {
    it('should add empty adunits array when the slots array is empty', async () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
      const step = a9RequestBids(a9ConfigStub);
      await step(contextWithConsent, []);
      expect(addAdUnitsSpy).not.to.have.been.called;
    });

    it('should request for the wanted ad slot', async () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
      const step = a9RequestBids(a9ConfigStub);

      const domId = getDomId();
      const singleSlot = createSlotDefinitions(domId, {});
      await step(contextWithConsent, [singleSlot]);
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

    it('should fetchBids only for un-throttled slots', async () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
      const step = a9RequestBids(a9ConfigStub);

      const domId1 = getDomId();
      const domId2 = getDomId();
      const slot1 = createSlotDefinitions(domId1, {});
      const slot2 = createSlotDefinitions(domId2, {});

      const isThrottled = sandbox.stub(contextWithConsent.auction__, 'isSlotThrottled');
      isThrottled.withArgs(domId1, slot1.adSlot.getAdUnitPath()).returns(false);
      isThrottled.withArgs(domId2, slot2.adSlot.getAdUnitPath()).returns(true);

      await step(contextWithConsent, [slot1, slot2]);
      expect(addAdUnitsSpy).to.have.been.calledOnce;
      expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly(
        {
          slots: [
            {
              slotID: domId1,
              slotName: slot1.adSlot.getAdUnitPath(),
              sizes: mediumRec
            }
          ]
        },
        Sinon.match.func
      );
    });

    it('should respect the supportedSizes configuration in the global a9 config', async () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
      const step = a9RequestBids({
        ...a9ConfigStub,
        supportedSizes: [[300, 250]]
      });

      const domId = getDomId();
      const singleSlot = createSlotDefinitions(domId, {});
      await step(contextWithConsent, [singleSlot]);
      expect(addAdUnitsSpy).to.have.been.calledOnce;
      expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly(
        {
          slots: [
            {
              slotID: domId,
              slotName: singleSlot.adSlot.getAdUnitPath(),
              sizes: [[300, 250]]
            }
          ]
        },
        Sinon.match.func
      );
    });

    it('should return mediaType video when wanted', async () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
      const step = a9RequestBids(a9ConfigStub);

      const domId = getDomId();
      const singleSlot = createSlotDefinitions(domId, {
        mediaType: 'video'
      });
      await step(contextWithConsent, [singleSlot]);
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

    it('should return video and display slots', async () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
      const step = a9RequestBids(a9ConfigStub);

      const displayDomId = getDomId();
      const displaySlot = createSlotDefinitions(displayDomId, {});

      const videoDomId = getDomId();
      const videoSlot = createSlotDefinitions(videoDomId, {
        mediaType: 'video'
      });
      await step(contextWithConsent, [displaySlot, videoSlot]);
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

    it('should add floor config if enabled', async () => {
      const fetchBidsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
      const step = a9RequestBids({ ...a9ConfigStub, enableFloorPrices: true });

      const domId = getDomId();
      const singleSlot = createSlotDefinitions(domId, {});
      singleSlot.priceRule = { floorprice: 0.1, main: false, priceRuleId: 1 };

      await step(contextWithConsent, [singleSlot]);
      expect(fetchBidsSpy).to.have.been.calledOnce;
      expect(fetchBidsSpy).to.have.been.calledOnceWithExactly(
        {
          slots: [
            {
              slotID: domId,
              slotName: singleSlot.adSlot.getAdUnitPath(),
              sizes: mediumRec,
              floor: {
                value: 12,
                currency: 'USD'
              }
            }
          ]
        },
        Sinon.match.func
      );
    });

    it('should use the prebid convertCurrency function if available', async () => {
      dom.window.pbjs = pbjsStub;

      const fetchBidsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
      const convertCurrencySpy = sandbox.spy(dom.window.pbjs, 'convertCurrency');
      const step = a9RequestBids({ ...a9ConfigStub, enableFloorPrices: true });

      const domId = getDomId();
      const singleSlot = createSlotDefinitions(domId, {});
      singleSlot.priceRule = { floorprice: 0.1, main: false, priceRuleId: 1 };

      await step(contextWithConsent, [singleSlot]);
      expect(convertCurrencySpy).to.have.been.calledOnce;
      expect(convertCurrencySpy).to.have.been.calledOnceWithExactly(0.1, 'EUR', 'USD');

      expect(fetchBidsSpy).to.have.been.calledOnce;
      expect(fetchBidsSpy).to.have.been.calledOnceWithExactly(
        {
          slots: [
            {
              slotID: domId,
              slotName: singleSlot.adSlot.getAdUnitPath(),
              sizes: mediumRec,
              floor: {
                value: 20,
                currency: 'USD'
              }
            }
          ]
        },
        Sinon.match.func
      );
      dom.window.pbjs = undefined;
    });

    it('should resolve immediately if no consent is given', async () => {
      const fetchBidsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
      const step = a9RequestBids({ ...a9ConfigStub, enableFloorPrices: true });

      const domId = getDomId();
      const singleSlot = createSlotDefinitions(domId, {});
      const tcDataNoPurpose1 = fullConsent();
      tcDataNoPurpose1.purpose.consents['1'] = false;
      const context: AdPipelineContext = {
        ...adPipelineContext(),
        tcData__: tcDataNoPurpose1
      };

      await step(context, [singleSlot]);
      expect(fetchBidsSpy).to.have.been.callCount(0);
    });

    describe('floor price', () => {
      ['USD' as const, 'EUR' as const].forEach(currency => {
        it(`should add floor config with configured currency ${currency}`, async () => {
          const fetchBidsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
          const step = a9RequestBids({
            ...a9ConfigStub,
            enableFloorPrices: true,
            floorPriceCurrency: currency
          });

          const domId = getDomId();
          const singleSlot = createSlotDefinitions(domId, {});
          singleSlot.priceRule = { floorprice: 0.1, main: false, priceRuleId: 1 };

          await step(contextWithConsent, [singleSlot]);
          expect(fetchBidsSpy).to.have.been.calledOnce;
          expect(fetchBidsSpy).to.have.been.calledOnceWithExactly(
            {
              slots: [
                {
                  slotID: domId,
                  slotName: singleSlot.adSlot.getAdUnitPath(),
                  sizes: mediumRec,
                  floor: {
                    value: 12, // value must be rounded up
                    currency: currency
                  }
                }
              ]
            },
            Sinon.match.func
          );
        });
      });
    });

    describe('slotId ad unit path resolving', () => {
      const slotWithAdUnitPath = (adUnitPath: string): MoliRuntime.SlotDefinition => {
        const domId = getDomId();
        const slot: AdSlot = {
          ...a9Slot(domId, {}),
          adUnitPath
        };
        return {
          moliSlot: slot,
          adSlot: googleAdSlotStub(slot.adUnitPath, slot.domId),
          filterSupportedSizes: sizes => sizes
        };
      };

      it('should use an ad unit path without the child network id', async () => {
        const addAdUnitsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
        const step = a9RequestBids(a9ConfigStub);

        const adUnitPath = '/1234567,1234/Travel/Berlin';
        const singleSlot = slotWithAdUnitPath(adUnitPath);

        await step(contextWithConsent, [singleSlot]);
        expect(addAdUnitsSpy).to.have.been.calledOnce;
        expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly(
          {
            slots: [
              {
                slotID: singleSlot.moliSlot.domId,
                slotName: '/1234567/Travel/Berlin',
                sizes: mediumRec
              }
            ]
          },
          Sinon.match.func
        );
      });

      [
        { labels: ['mobile'], device: 'mobile', domain: 'example.com' },
        { labels: ['desktop'], device: 'desktop', domain: 'acme.org' },
        { labels: [] as string[], device: 'mobile', domain: 'foo.co.uk' }
      ].forEach(({ labels, device, domain }) => {
        it(`should resolve the ad unit path with [${labels.join(
          ','
        )}], device: ${device}, domain: ${domain}`, async () => {
          const ctxWithLabelServiceStub: AdPipelineContext = {
            ...adPipelineContext('production', emptyConfig),
            adUnitPathVariables__: { domain, device },
            tcData__: fullConsent({ '793': true })
          };
          const getSupportedLabelsStub = sandbox.stub(
            ctxWithLabelServiceStub.labelConfigService__,
            'getSupportedLabels'
          );
          getSupportedLabelsStub.returns(labels);

          const addAdUnitsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
          const step = a9RequestBids(a9ConfigStub);

          const adUnitPath = '/1234567/pub/content_1/{device}/{domain}';
          const singleSlot = slotWithAdUnitPath(adUnitPath);

          await step(ctxWithLabelServiceStub, [singleSlot]);

          expect(addAdUnitsSpy).to.have.been.calledOnce;
          expect(addAdUnitsSpy).to.have.been.calledOnceWithExactly(
            {
              slots: [
                {
                  slotID: singleSlot.moliSlot.domId,
                  slotName: `/1234567/pub/content_1/${device}/${domain}`,
                  sizes: mediumRec
                }
              ]
            },
            Sinon.match.func
          );
        });
      });
    });

    it('should use the timeout in the adPipeline context', async () => {
      const addAdUnitsSpy = sandbox.spy(dom.window.apstag, 'fetchBids');
      const step = a9RequestBids(a9ConfigStub);
      const contextWithConsentWithTimeout: AdPipelineContext = {
        ...contextWithConsent,
        bucket__: { timeout: 3000 }
      };
      const domId = getDomId();
      const singleSlot = createSlotDefinitions(domId, {});

      await step(contextWithConsentWithTimeout, [singleSlot]);
      expect(addAdUnitsSpy).to.have.been.calledOnce;
      expect(addAdUnitsSpy).to.have.been.calledOnceWith(Sinon.match.has('bidTimeout', 3000));
    });
  });

  describe('a9 clear targeting', () => {
    const makeGetTargetingKeysStub = (
      slot: googletag.IAdSlot,
      keys: string[] = ['amznp', 'amznsz', 'amznbid']
    ): Sinon.SinonStub<[], string[]> => {
      return sandbox.stub(slot, 'getTargetingKeys').returns(keys);
    };

    it('should not run on the first pipeline run', async () => {
      const step = a9ClearTargetingStep();
      const slot = createSlotDefinitions(getDomId(), {});

      const clearTargetingSpy = sandbox.spy(slot.adSlot, 'clearTargeting');
      const getTargetingKeysStub = makeGetTargetingKeysStub(slot.adSlot);
      const ctx: AdPipelineContext = { ...adPipelineContext(), requestId__: 0 };

      await step(ctx, [slot]);
      expect(clearTargetingSpy).to.have.not.been.called;
      expect(getTargetingKeysStub).to.have.not.been.called;
    });

    it('should run on the second pipeline run', async () => {
      const step = a9ClearTargetingStep();
      const slot = createSlotDefinitions(getDomId(), {});

      const clearTargetingSpy = sandbox.spy(slot.adSlot, 'clearTargeting');
      const getTargetingKeysStub = makeGetTargetingKeysStub(slot.adSlot);
      const ctx: AdPipelineContext = { ...contextWithConsent, requestId__: 1 };

      await step(ctx, [slot]);
      expect(getTargetingKeysStub).to.have.been.calledOnce;
      expect(clearTargetingSpy).to.have.been.calledThrice;
      expect(clearTargetingSpy).to.have.been.calledWith('amznp');
      expect(clearTargetingSpy).to.have.been.calledWith('amznsz');
      expect(clearTargetingSpy).to.have.been.calledWith('amznbid');
    });

    it('should clear targeting only for the available keys', async () => {
      const step = a9ClearTargetingStep();
      const slot = createSlotDefinitions(getDomId(), {});

      const clearTargetingSpy = sandbox.spy(slot.adSlot, 'clearTargeting');
      const getTargetingKeysStub = makeGetTargetingKeysStub(slot.adSlot, ['amznp', 'foo']);
      const ctx: AdPipelineContext = { ...contextWithConsent, requestId__: 1 };

      await step(ctx, [slot]);
      expect(getTargetingKeysStub).to.have.been.calledOnce;
      expect(clearTargetingSpy).to.have.been.calledOnce;
      expect(clearTargetingSpy).to.have.been.calledWith('amznp');
    });
  });
});
