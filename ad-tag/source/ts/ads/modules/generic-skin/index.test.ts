import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { Skin, SkinConfigEffect } from './index';
import { createDom } from 'ad-tag/stubs/browserEnvSetup';
import { googletag } from 'ad-tag/types/googletag';
import { createGoogletagStub } from 'ad-tag/stubs/googletagStubs';
import { AdSlot, headerbidding, modules, MoliConfig } from 'ad-tag/types/moliConfig';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { emptyConfig, emptyRuntimeConfig, newNoopLogger, noopLogger } from 'ad-tag/stubs/moliStubs';
import { createAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { dummySchainConfig } from 'ad-tag/stubs/schainStubs';
import { createPbjsStub, pbjsTestConfig } from 'ad-tag/stubs/prebidjsStubs';
import { AdPipelineContext } from '../../adPipeline';
import { fullConsent } from 'ad-tag/stubs/consentStubs';
import { GlobalAuctionContext } from '../../globalAuctionContext';
import { useFakeTimers } from 'sinon';

// setup sinon-chai
use(sinonChai);

/**
 * All bidders that require no additional configuration other than the bidder code
 */
type SimpleFormatFilterBidder = Exclude<modules.skin.FormatFilter['bidder'], 'gumgum' | '*'>;

describe('Skin Module', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow =
    dom.window as any;
  jsDomWindow.googletag = createGoogletagStub();
  jsDomWindow.pbjs = createPbjsStub();
  let assetLoaderService = createAssetLoaderService(jsDomWindow);
  let pubadsGetSlotsStub = sandbox.stub(jsDomWindow.googletag.pubads(), 'getSlots');

  let onEventSpy = sandbox.spy(jsDomWindow.pbjs, 'onEvent');
  let destroyAdSlotSpy = sandbox.spy(jsDomWindow.googletag, 'destroySlots');

  const emitAuctionEnd = (bids: prebidjs.IBidResponsesMap): void => {
    expect(onEventSpy).to.have.been.calledOnce;
    const [event, callback] = onEventSpy.firstCall.args;
    // typescript infers the wrong callback type for the sinonSpy. Maybe an EventMap implementation solves this.
    // for now we have to disable the type check here
    // @ts-ignore
    callback(auctionObject(bids));
  };

  afterEach(() => {
    sandbox.reset();
    dom = createDom();
    jsDomWindow = dom.window as any;
    jsDomWindow.googletag = createGoogletagStub();
    jsDomWindow.pbjs = createPbjsStub();
    assetLoaderService = createAssetLoaderService(jsDomWindow);
    pubadsGetSlotsStub = sandbox.stub(jsDomWindow.googletag.pubads(), 'getSlots');
    onEventSpy = sandbox.spy(jsDomWindow.pbjs, 'onEvent');
    destroyAdSlotSpy = sandbox.spy(jsDomWindow.googletag, 'destroySlots');
  });

  const createAdSlots = (domIds: string[]): AdSlot[] => {
    return domIds.map(domId => {
      const div = jsDomWindow.document.createElement('div');
      div.id = domId;
      jsDomWindow.document.body.appendChild(div);

      const slot: AdSlot = {
        domId: domId,
        adUnitPath: domId,
        position: 'in-page',
        sizes: [],
        behaviour: { loaded: 'eager' },
        labelAll: [],
        labelAny: [],
        sizeConfig: []
      };
      return slot;
    });
  };

  const createGoogleAdSlot = (domId: string): googletag.IAdSlot =>
    ({
      domId, // makes deepEquals output more readable
      getSlotElementId(): string {
        return domId;
      }
    } as googletag.IAdSlot & { domId: string });

  const auctionObject = (from: prebidjs.IBidResponsesMap): prebidjs.event.AuctionObject => ({
    auctionId: 'xxxx-xxxx-xxxx-xxxx',
    adUnitCodes: Object.keys(from),
    bidsReceived: Object.entries(from).flatMap(([adUnitCode, bidResponses]) => {
      return (bidResponses?.bids ?? []).map(bid => {
        return {
          ...bid,
          adUnitCode: adUnitCode // set the adUnitCode as it's not provided in the bid responses all the time in the test setup
        } as prebidjs.BidResponse;
      });
    }),
    winningBids: []
  });

  const genericBidResponse = (
    bidder: prebidjs.IGenericBidResponse['bidder'],
    cpm: number
  ): prebidjs.IGenericBidResponse =>
    ({
      bidder: bidder,
      cpm,
      adId: '',
      height: 1,
      width: 1,
      mediaType: 'banner',
      source: 'client',
      ad: '<h1>AD</h1>',
      adUnitCode: '',
      auctionId: '',
      currency: 'EUR',
      originalCurrency: 'EUR',
      netRevenue: true
    } as prebidjs.IGenericBidResponse);

  const dspxBidResponse = (cpm: number): prebidjs.IGenericBidResponse =>
    genericBidResponse(prebidjs.DSPX, cpm);
  const visxBidResponse = (cpm: number): prebidjs.IGenericBidResponse =>
    genericBidResponse(prebidjs.Visx, cpm);

  const adPipelineContext = (config: MoliConfig = emptyConfig): AdPipelineContext => {
    return {
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: noopLogger,
      config: config,
      runtimeConfig: emptyRuntimeConfig,
      window: jsDomWindow as any,
      // no service dependencies required
      labelConfigService: null as any,
      tcData: fullConsent(),
      adUnitPathVariables: {},
      auction: new GlobalAuctionContext(jsDomWindow as any)
    };
  };

  type SkinModuleConfig = Omit<modules.skin.SkinModuleConfig, 'enabled'>;
  const emptySkinModuleConfig: modules.skin.SkinModuleConfig = { enabled: true, configs: [] };

  const modulesConfig = (skin: SkinModuleConfig): modules.ModulesConfig => ({
    skin: {
      ...skin,
      enabled: true
    }
  });

  const skinModule = (skin: SkinModuleConfig = emptySkinModuleConfig): Skin => {
    const module = new Skin();
    module.configure(modulesConfig(skin));
    return module;
  };

  describe('init', () => {
    it('should add an init step', async () => {
      const module = skinModule();

      const initSteps = module.initSteps();

      expect(initSteps).to.have.length(1);
      expect(initSteps[0].name).to.be.eq('skin-init');
    });

    it('should add pbjs.onEvent("auctionEnd") listener in production', async () => {
      const noopLogger = newNoopLogger();
      const module = skinModule();

      const errorLogSpy = sandbox.spy(noopLogger, 'error');

      const initSteps = module.initSteps();

      await initSteps[0](adPipelineContext());

      expect(errorLogSpy).to.have.not.been.called;
      expect(onEventSpy).to.have.been.calledOnce;
      expect(onEventSpy).to.have.been.calledOnceWithExactly('auctionEnd', Sinon.match.func);
    });

    it('should not add pbjs.onEvent("auctionEnd") listener in test', async () => {
      const noopLogger = newNoopLogger();
      const module = skinModule();

      const errorLogSpy = sandbox.spy(noopLogger, 'error');

      const initSteps = module.initSteps();

      await initSteps[0]({ ...adPipelineContext(), env: 'test' });

      expect(errorLogSpy).to.have.not.been.called;
      expect(onEventSpy).to.have.not.been.called;
    });
  });

  describe('checkConfig filter evaluation', () => {
    const module = skinModule();

    // ----  GumGum -----
    const gumgumBidResponse = (
      ad: prebidjs.IGumGumBidResponseWrapper | string
    ): prebidjs.IGumGumBidResponse =>
      ({
        bidder: prebidjs.GumGum,
        adId: '',
        cpm: 10.0,
        height: 1,
        width: 1,
        mediaType: 'banner',
        source: 'client',
        ad: ad,
        adUnitCode: '',
        auctionId: '',
        currency: 'EUR',
        originalCurrency: 'EUR',
        netRevenue: true
      } as prebidjs.IGumGumBidResponse);

    describe('gumgum mobile skin', () => {
      const config: modules.skin.SkinConfig = {
        formatFilter: [{ bidder: 'gumgum', auid: 59 }],
        skinAdSlotDomId: 'mobile-skin-slot',
        blockedAdSlotDomIds: ['sky-slot'],
        hideSkinAdSlot: false,
        hideBlockedSlots: false,
        enableCpmComparison: false
      };

      it('should return `BlockOtherSlots` if a gumgum mobile skin was found', () => {
        const skinConfigEffect = module.getConfigEffect(
          config,
          auctionObject({
            'mobile-skin-slot': {
              bids: [gumgumBidResponse({ auid: 59 })]
            }
          }),
          noopLogger,
          undefined
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should return `NoBlocking` if a gumgum mobile skin was found but cpm 0', () => {
        const skinConfigEffect = module.getConfigEffect(
          config,
          auctionObject({
            'mobile-skin-slot': {
              bids: [{ ...gumgumBidResponse({ auid: 59 }), cpm: 0 }]
            }
          }),
          noopLogger,
          undefined
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
      });

      it('should return `NoBlocking` if the gumgum format does not match was found', () => {
        const skinConfigEffect = module.getConfigEffect(
          config,
          auctionObject({
            'mobile-skin-slot': {
              bids: [gumgumBidResponse('some markup'), gumgumBidResponse({ auid: 39 })]
            }
          }),
          noopLogger,
          undefined
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
      });
    });

    describe('gumgum no auid', () => {
      const config: modules.skin.SkinConfig = {
        formatFilter: [{ bidder: 'gumgum' }],
        skinAdSlotDomId: 'mobile-skin-slot',
        blockedAdSlotDomIds: ['sky-slot'],
        hideSkinAdSlot: false,
        hideBlockedSlots: false,
        enableCpmComparison: false
      };

      it('should return `BlockOtherSlots` if a gumgum mobile skin was found', () => {
        const skinConfigEffect = module.getConfigEffect(
          config,
          auctionObject({
            'mobile-skin-slot': {
              bids: [gumgumBidResponse({ auid: 59 })]
            }
          }),
          noopLogger,
          undefined
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should return `BlockOtherSlots` if a gumgum mobile skin was found with markup', () => {
        const skinConfigEffect = module.getConfigEffect(
          config,
          auctionObject({
            'mobile-skin-slot': {
              bids: [gumgumBidResponse('markup')]
            }
          }),
          noopLogger,
          undefined
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });
    });

    describe('* ( AllFormatFilter )', () => {
      const config: modules.skin.SkinConfig = {
        formatFilter: [{ bidder: '*' }],
        skinAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: ['sky-slot'],
        hideSkinAdSlot: false,
        hideBlockedSlots: false,
        enableCpmComparison: true
      };
      it('should return `BlockOtherSlots` if any response was found', () => {
        const skinConfigEffect = module.getConfigEffect(
          config,
          auctionObject({
            'wp-slot': {
              bids: [genericBidResponse('ix', 10.0)]
            }
          }),
          noopLogger,
          undefined
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should return `NoBlocking` if a bid response was found but with cpm 0', () => {
        const skinConfigEffect = module.getConfigEffect(
          config,
          auctionObject({
            'wp-slot': {
              bids: [genericBidResponse('pubmatic', 0)]
            }
          }),
          noopLogger,
          undefined
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
      });

      it('should return `BlockSkinSlot`if the skin bid is lower than the bids on the to-be-removed slots combined', () => {
        const skinConfigEffect = module.getConfigEffect(
          config,
          auctionObject({
            'wp-slot': {
              bids: [genericBidResponse('pubmatic', 5)]
            },
            'sky-slot': {
              bids: [genericBidResponse('openx', 6.5), genericBidResponse('openx', 0.49)]
            }
          }),
          noopLogger,
          undefined
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockSkinSlot);
      });
    });

    // list of simple configurations
    const bidders: SimpleFormatFilterBidder[] = [
      'yieldlab',
      'visx',
      'dspx',
      'appnexus',
      'appnexusAst',
      'improvedigital'
    ];

    bidders.forEach(bidder =>
      describe(bidder, () => {
        const config: modules.skin.SkinConfig = {
          formatFilter: [{ bidder: bidder }],
          skinAdSlotDomId: 'wp-slot',
          blockedAdSlotDomIds: ['sky-slot'],
          hideSkinAdSlot: false,
          hideBlockedSlots: false,
          enableCpmComparison: false
        };
        it(`should return \`BlockOtherSlots\` if a ${bidder} response was found`, () => {
          const skinConfigEffect = module.getConfigEffect(
            config,
            auctionObject({
              'wp-slot': {
                bids: [genericBidResponse(bidder, 10.0)]
              }
            }),
            noopLogger,
            undefined
          );

          expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
        });

        it(`should return \`NoBlocking\` if a ${bidder} response was found but with cpm 0`, () => {
          const skinConfigEffect = module.getConfigEffect(
            config,
            auctionObject({
              'wp-slot': {
                bids: [genericBidResponse(bidder, 0)]
              }
            }),
            noopLogger,
            undefined
          );

          expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
        });
      })
    );

    describe('enableCpmComparison: getConfigEffect', () => {
      const trackSkinCpmLow = sandbox.stub();

      beforeEach(() => trackSkinCpmLow.reset());

      it('should return `BlockOtherSlots`, but log the result if the skin bid is low but the comparison is disabled', () => {
        const configuredModule = skinModule({ configs: [], trackSkinCpmLow });

        const config: modules.skin.SkinConfig = {
          formatFilter: [{ bidder: prebidjs.GumGum }],
          skinAdSlotDomId: 'wp-slot',
          blockedAdSlotDomIds: ['sky-slot', 'sky-slot-2', 'sky-slot-3'],
          hideSkinAdSlot: false,
          hideBlockedSlots: false,
          enableCpmComparison: false
        };

        const bidResponses: prebidjs.IBidResponsesMap = {
          'wp-slot': {
            bids: [
              { ...gumgumBidResponse('<h1>skin</h1>'), cpm: 1.5 },
              genericBidResponse('openx', 1)
            ]
          },
          'sky-slot': {
            bids: [genericBidResponse('openx', 1.5), genericBidResponse('openx', 0.49)]
          },
          'sky-slot-2': {
            bids: [genericBidResponse('openx', 0.01), genericBidResponse('openx', 0)]
          },
          'sky-slot-3': undefined
        };

        const skinConfigEffect = configuredModule.getConfigEffect(
          config,
          auctionObject(bidResponses),
          noopLogger,
          trackSkinCpmLow
        );
        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
        expect(trackSkinCpmLow).to.have.been.calledOnce;
        expect(trackSkinCpmLow).to.have.been.calledOnceWithExactly(
          {
            skin: 1.5,
            combinedNonSkinSlots: 1.51
          },
          config,
          { ...gumgumBidResponse('<h1>skin</h1>'), cpm: 1.5, adUnitCode: 'wp-slot' }
        );
      });

      it('should return `BlockSkinSlot` if the skin bid is lower than the bids on the to-be-removed slots combined', () => {
        const configuredModule = skinModule({
          configs: [],
          trackSkinCpmLow
        });

        const config: modules.skin.SkinConfig = {
          formatFilter: [{ bidder: prebidjs.DSPX }],
          skinAdSlotDomId: 'wp-slot',
          blockedAdSlotDomIds: ['sky-slot', 'sky-slot-2'],
          hideSkinAdSlot: false,
          hideBlockedSlots: false,
          enableCpmComparison: true
        };

        const skinConfigEffect = configuredModule.getConfigEffect(
          config,
          auctionObject({
            'wp-slot': {
              bids: [dspxBidResponse(1.5), genericBidResponse('openx', 1)]
            },
            'sky-slot': {
              bids: [genericBidResponse('openx', 1.5), genericBidResponse('openx', 0.49)]
            },
            'sky-slot-2': {
              bids: [genericBidResponse('openx', 0.01), genericBidResponse('openx', 0)]
            }
          }),
          noopLogger,
          trackSkinCpmLow
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockSkinSlot);
        expect(trackSkinCpmLow).to.have.been.calledOnce;
      });

      it('should return `BlockOtherSlots` if the skin bid is higher than the bids on the to-be-removed slots combined', () => {
        const configuredModule = new Skin();

        const config: modules.skin.SkinConfig = {
          formatFilter: [{ bidder: prebidjs.DSPX }],
          skinAdSlotDomId: 'wp-slot',
          blockedAdSlotDomIds: ['sky-slot', 'sky-slot-2'],
          hideSkinAdSlot: false,
          hideBlockedSlots: false,
          enableCpmComparison: true
        };

        const skinConfigEffect = configuredModule.getConfigEffect(
          config,
          auctionObject({
            'wp-slot': {
              bids: [dspxBidResponse(1.5), genericBidResponse('openx', 1)]
            },
            'sky-slot': {
              bids: [genericBidResponse('openx', 0.5), genericBidResponse('openx', 0.49)]
            },
            'sky-slot-2': {
              bids: [genericBidResponse('openx', 0.01), genericBidResponse('openx', 0)]
            }
          }),
          noopLogger,
          undefined
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });
    });

    describe('selectConfig filter selection', () => {
      const wallpaperConfig: modules.skin.SkinConfig = {
        formatFilter: [{ bidder: prebidjs.GumGum }],
        skinAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: ['sky-slot'],
        hideSkinAdSlot: false,
        hideBlockedSlots: false,
        enableCpmComparison: false
      };

      const mobileSkinConfig: modules.skin.SkinConfig = {
        formatFilter: [{ bidder: prebidjs.GumGum, auid: 59 }],
        skinAdSlotDomId: 'mobile-sticky',
        blockedAdSlotDomIds: ['content-1'],
        hideSkinAdSlot: false,
        hideBlockedSlots: false,
        enableCpmComparison: false
      };

      it('should select the first rule that applies', () => {
        const config = modulesConfig({
          configs: [wallpaperConfig, mobileSkinConfig]
        });
        const configuredModule = skinModule(config.skin);

        // select desktop wallpaper
        const wpConfig = configuredModule.selectConfig(
          config.skin!,
          auctionObject({
            'wp-slot': { bids: [gumgumBidResponse('<h1>skin</h1>')] }
          }),
          noopLogger
        );
        expect(wpConfig?.skinConfig).to.equal(wallpaperConfig);
        expect(wpConfig?.configEffect).to.equal(SkinConfigEffect.BlockOtherSlots);

        // select mobile skin
        const mobileConfig = configuredModule.selectConfig(
          config.skin!,
          auctionObject({
            'mobile-sticky': { bids: [gumgumBidResponse({ auid: 59 })] }
          }),
          noopLogger
        );
        expect(mobileConfig?.skinConfig).to.equal(mobileSkinConfig);
        expect(mobileConfig?.configEffect).to.equal(SkinConfigEffect.BlockOtherSlots);

        // select wallpaper config skin
        const wp2Config = configuredModule.selectConfig(
          config.skin!,
          auctionObject({
            'wp-slot': { bids: [gumgumBidResponse('wp'), gumgumBidResponse('mt')] }
          }),
          noopLogger
        );
        expect(wp2Config?.skinConfig).to.equal(wallpaperConfig);
        expect(wp2Config?.configEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should select the highest skin bid if there are multiple skin bids', () => {
        const trackSkinCpmLow = sandbox.stub();

        const config: modules.skin.SkinConfig = {
          formatFilter: [{ bidder: prebidjs.GumGum }, { bidder: prebidjs.DSPX }],
          skinAdSlotDomId: 'wp-slot',
          blockedAdSlotDomIds: ['sky-slot', 'sky-slot-2', 'sky-slot-3'],
          hideSkinAdSlot: false,
          hideBlockedSlots: false,
          enableCpmComparison: true
        };
        const moduleConfig = modulesConfig({
          configs: [config],
          trackSkinCpmLow
        });
        const configuredModule = skinModule(moduleConfig.skin);

        // gumgum has 1.50 cpm
        // other bids combined have 1.51 cpm
        // dspx has 1.52 cpm and will be selected
        const bidResponses: prebidjs.IBidResponsesMap = {
          'wp-slot': {
            bids: [{ ...gumgumBidResponse('<h1>skin</h1>'), cpm: 1.5 }, dspxBidResponse(1.52)]
          },
          'sky-slot': {
            bids: [genericBidResponse('openx', 0.5), genericBidResponse('openx', 0.49)]
          },
          'sky-slot-2': {
            bids: [genericBidResponse('openx', 0.01), genericBidResponse('openx', 0)]
          },
          'sky-slot-3': undefined
        };

        const skinConfig = configuredModule.selectConfig(
          moduleConfig.skin!,
          auctionObject(bidResponses),
          noopLogger
        );

        expect(skinConfig?.skinConfig).to.equal(config);
        expect(skinConfig?.configEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
        expect(trackSkinCpmLow).to.not.have.been.called;
      });
    });

    describe('destroySkinSlot', () => {
      const sidebarDomId = 'sky-slot';
      const skinDomId = 'wp-slot';
      let slots: AdSlot[] = [];

      const sidebarSlot = createGoogleAdSlot(sidebarDomId);
      const skinSlot = createGoogleAdSlot(skinDomId);

      beforeEach(() => {
        slots = createAdSlots([skinDomId, sidebarDomId]);
      });

      [undefined, false].forEach(destroySkinSlot => {
        it(`should not destroy the skin ad slot destroySkinSlot is set to ${destroySkinSlot}`, () => {
          const module = skinModule({
            configs: [
              {
                formatFilter: [{ bidder: prebidjs.DSPX }],
                skinAdSlotDomId: skinDomId,
                blockedAdSlotDomIds: [sidebarDomId],
                hideSkinAdSlot: false,
                hideBlockedSlots: false,
                enableCpmComparison: false,
                ...(destroySkinSlot !== undefined ? { destroySkinSlot } : {})
              }
            ]
          });

          const prebidConfig: headerbidding.PrebidConfig = {
            config: pbjsTestConfig,
            schain: { nodes: [] }
          };

          const config: MoliConfig = {
            slots: slots,
            prebid: prebidConfig,
            schain: dummySchainConfig
          };
          module.initSteps()[0](adPipelineContext(config));

          pubadsGetSlotsStub.returns([sidebarSlot, skinSlot]);
          emitAuctionEnd({});

          expect(destroyAdSlotSpy).to.have.not.been.called;
        });
      });

      it('should not destroy the skin ad slot if set to true for a bidder and the other delivers', () => {
        const module = skinModule({
          configs: [
            {
              formatFilter: [{ bidder: prebidjs.Visx }],
              skinAdSlotDomId: skinDomId,
              blockedAdSlotDomIds: [sidebarDomId],
              hideSkinAdSlot: false,
              hideBlockedSlots: false,
              enableCpmComparison: false,
              destroySkinSlot: true
            },
            {
              formatFilter: [{ bidder: prebidjs.DSPX }],
              skinAdSlotDomId: skinDomId,
              blockedAdSlotDomIds: [sidebarDomId],
              hideSkinAdSlot: false,
              hideBlockedSlots: false,
              enableCpmComparison: false,
              destroySkinSlot: true
            }
          ]
        });

        const prebidConfig: headerbidding.PrebidConfig = {
          config: pbjsTestConfig,
          schain: { nodes: [] }
        };

        const config: MoliConfig = {
          slots: slots,
          prebid: prebidConfig,
          schain: dummySchainConfig
        };
        module.initSteps()[0](adPipelineContext(config));

        pubadsGetSlotsStub.returns([sidebarSlot, skinSlot]);
        emitAuctionEnd({ [skinDomId]: { bids: [dspxBidResponse(1)] } });

        // only the sky slot should be destroyed
        expect(destroyAdSlotSpy).to.have.been.calledOnce;
        expect(destroyAdSlotSpy).to.have.been.calledOnceWithExactly(
          Sinon.match.array.deepEquals([sidebarSlot])
        );
      });

      it('should destroy the skin ad slot if set to true', () => {
        const module = skinModule({
          configs: [
            {
              formatFilter: [{ bidder: prebidjs.DSPX }],
              skinAdSlotDomId: skinDomId,
              blockedAdSlotDomIds: [sidebarDomId],
              hideSkinAdSlot: false,
              hideBlockedSlots: false,
              enableCpmComparison: false,
              destroySkinSlot: true
            }
          ]
        });

        const prebidConfig: headerbidding.PrebidConfig = {
          config: pbjsTestConfig,
          schain: { nodes: [] }
        };

        const config: MoliConfig = {
          slots: slots,
          prebid: prebidConfig,
          schain: dummySchainConfig
        };
        module.initSteps()[0](adPipelineContext(config));
        pubadsGetSlotsStub.returns([sidebarSlot, skinSlot]);
        emitAuctionEnd({});

        expect(destroyAdSlotSpy).to.have.been.calledOnce;
        expect(destroyAdSlotSpy).to.have.been.calledOnceWithExactly(
          Sinon.match.array.deepEquals([skinSlot])
        );
      });

      it('should destroy the skin ad slot only once', () => {
        const module = skinModule({
          configs: [
            {
              formatFilter: [{ bidder: prebidjs.DSPX }],
              skinAdSlotDomId: skinDomId,
              blockedAdSlotDomIds: [skinDomId],
              hideSkinAdSlot: false,
              hideBlockedSlots: false,
              enableCpmComparison: false,
              destroySkinSlot: true
            },
            {
              formatFilter: [{ bidder: prebidjs.Visx }],
              skinAdSlotDomId: skinDomId,
              blockedAdSlotDomIds: [skinDomId],
              hideSkinAdSlot: false,
              hideBlockedSlots: false,
              enableCpmComparison: false,
              destroySkinSlot: true
            }
          ]
        });

        const prebidConfig: headerbidding.PrebidConfig = {
          config: pbjsTestConfig,
          schain: { nodes: [] }
        };

        const config: MoliConfig = {
          slots: slots,
          prebid: prebidConfig,
          schain: dummySchainConfig
        };
        module.initSteps()[0](adPipelineContext(config));
        pubadsGetSlotsStub.returns([sidebarSlot, skinSlot]);
        emitAuctionEnd({ [skinDomId]: { bids: [dspxBidResponse(1)] } });

        expect(destroyAdSlotSpy).to.have.been.calledOnce;
        expect(destroyAdSlotSpy).to.have.been.calledOnceWithExactly(
          Sinon.match.array.deepEquals([skinSlot])
        );
      });

      describe('skin adReload', () => {
        let clock: Sinon.SinonFakeTimers;

        beforeEach(() => {
          clock = useFakeTimers();
        });

        afterEach(() => {
          clock.restore();
        });

        it('should set a timeout if bidder is configured in adReload and is about to win the auction', () => {
          const module = skinModule({
            configs: [
              {
                formatFilter: [{ bidder: prebidjs.DSPX }],
                skinAdSlotDomId: 'wp-slot',
                blockedAdSlotDomIds: ['sky-slot'],
                hideSkinAdSlot: false,
                hideBlockedSlots: false,
                enableCpmComparison: false,
                destroySkinSlot: true,
                adReload: { allowed: [prebidjs.DSPX], intervalMs: 1000 }
              }
            ]
          });

          const prebidConfig: headerbidding.PrebidConfig = {
            config: pbjsTestConfig,
            schain: { nodes: [] }
          };

          const config: MoliConfig = {
            slots: slots,
            prebid: prebidConfig,
            schain: dummySchainConfig
          };

          // Spy on setTimeout
          const setTimeoutSpy = Sinon.spy(global, 'setTimeout');

          module.initSteps()[0](adPipelineContext(config));
          pubadsGetSlotsStub.returns([sidebarSlot, skinSlot]);
          emitAuctionEnd({ [skinDomId]: { bids: [dspxBidResponse(1)] } });

          expect(setTimeoutSpy).to.have.been.calledOnce;
        });

        it('should clear an "old" timeout before activating a new one', () => {
          const module = skinModule({
            configs: [
              {
                formatFilter: [{ bidder: prebidjs.DSPX }],
                skinAdSlotDomId: 'wp-slot',
                blockedAdSlotDomIds: ['sky-slot'],
                hideSkinAdSlot: false,
                hideBlockedSlots: false,
                enableCpmComparison: false,
                destroySkinSlot: true,
                adReload: { allowed: [prebidjs.DSPX], intervalMs: 1000 }
              }
            ]
          });

          const prebidConfig: headerbidding.PrebidConfig = {
            config: pbjsTestConfig,
            schain: { nodes: [] }
          };

          const config: MoliConfig = {
            slots: slots,
            prebid: prebidConfig,
            schain: dummySchainConfig
          };

          let activeTimeouts = 0;
          // Stub setTimeout
          const originalSetTimeout = global.setTimeout;
          const originalClearTimeout = global.clearTimeout;

          Sinon.stub(global, 'setTimeout').callsFake((handler, timeout) => {
            activeTimeouts++;
            const id = originalSetTimeout(handler, timeout);
            return id;
          });

          Sinon.stub(global, 'clearTimeout').callsFake(id => {
            activeTimeouts--;
            originalClearTimeout(id);
          });

          module.initSteps()[0](adPipelineContext(config));
          pubadsGetSlotsStub.returns([sidebarSlot, skinSlot]);
          emitAuctionEnd({ [skinDomId]: { bids: [dspxBidResponse(1)] } });
          emitAuctionEnd({ [skinDomId]: { bids: [dspxBidResponse(1)] } });

          expect(activeTimeouts).to.equal(1);
        });
      });
    });
  });
});
