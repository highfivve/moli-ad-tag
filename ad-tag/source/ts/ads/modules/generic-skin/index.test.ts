import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { createGoogletagStub } from 'ad-tag/stubs/googletagStubs';

import { filterHighestNonSkinBid, createSkin, ISkinModule, SkinConfigEffect } from './index';
import { AdSlot, headerbidding, modules, MoliConfig } from 'ad-tag/types/moliConfig';
import { googletag } from 'ad-tag/types/googletag';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { prebidjs } from 'ad-tag/types/prebidjs';
import {
  emptyConfig,
  emptyRuntimeConfig,
  newGlobalAuctionContext,
  noopLogger
} from 'ad-tag/stubs/moliStubs';
import { createAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { pbjsTestConfig } from 'ad-tag/stubs/prebidjsStubs';
import { dummySchainConfig } from 'ad-tag/stubs/schainStubs';
import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import { fullConsent } from 'ad-tag/stubs/consentStubs';
import { initAdTag } from 'ad-tag/ads/moliGlobal';

// setup sinon-chai
use(sinonChai);

/**
 * All bidders that require no additional configuration other than the bidder code
 */
type SimpleFormatFilterBidder = Exclude<modules.skin.FormatFilter['bidder'], 'gumgum' | '*'>;

describe('Skin Module', () => {
  const sandbox = Sinon.createSandbox();
  let { jsDomWindow } = createDomAndWindow();
  jsDomWindow.googletag = createGoogletagStub();

  const prebidConfig: headerbidding.PrebidConfig = {
    config: pbjsTestConfig,
    schain: { nodes: [] }
  };

  let assetLoaderService = createAssetLoaderService(jsDomWindow);

  afterEach(() => {
    jsDomWindow = createDomAndWindow().jsDomWindow;
    jsDomWindow.googletag = createGoogletagStub();
    assetLoaderService = createAssetLoaderService(jsDomWindow);
    sandbox.reset();
  });

  const createAdSlots = (window: Window, domIds: string[]): AdSlot[] => {
    return domIds.map(domId => {
      const div = window.document.createElement('div');
      div.id = domId;
      window.document.body.appendChild(div);

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
      getSlotElementId: () => domId
    }) as googletag.IAdSlot;

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
    }) as prebidjs.IGenericBidResponse;

  const dspxBidResponse = (cpm: number): prebidjs.IGenericBidResponse =>
    genericBidResponse(prebidjs.DSPX, cpm);
  const visxBidResponse = (cpm: number): prebidjs.IGenericBidResponse =>
    genericBidResponse(prebidjs.Visx, cpm);

  const adPipelineContext = (config: MoliConfig = emptyConfig): AdPipelineContext => {
    return {
      auctionId__: 'xxxx-xxxx-xxxx-xxxx',
      requestId__: 0,
      requestAdsCalls__: 1,
      env__: 'production',
      logger__: noopLogger,
      config__: config,
      runtimeConfig__: emptyRuntimeConfig,
      window__: jsDomWindow as any,
      // no service dependencies required
      labelConfigService__: null as any,
      tcData__: fullConsent(),
      adUnitPathVariables__: {},
      auction__: newGlobalAuctionContext(jsDomWindow),
      assetLoaderService__: assetLoaderService
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

  const skinModule = (skin: SkinModuleConfig = emptySkinModuleConfig): ISkinModule => {
    const module = createSkin();
    module.configure__(modulesConfig(skin));
    return module;
  };

  describe('configure', () => {
    it('should return no prebid bids back handler if not configured', () => {
      const module = createSkin();
      expect(module.prebidBidsBackHandler__).to.be.ok;
      expect(module.prebidBidsBackHandler__()).to.have.length(0);
    });

    it('should return no prebid bids back handler if disabled', () => {
      const module = createSkin();
      module.configure__({
        skin: { enabled: false, configs: [] }
      });
      expect(module.prebidBidsBackHandler__).to.be.ok;
      expect(module.prebidBidsBackHandler__()).to.have.length(0);
    });

    it('should add a prebid bids back handler', () => {
      const module = skinModule();
      expect(module.prebidBidsBackHandler__).to.be.ok;
      expect(module.prebidBidsBackHandler__()).to.be.have.length(1);
    });

    it('should create only one bids back handler', () => {
      const module = skinModule();
      expect(module.prebidBidsBackHandler__).to.be.ok;
      const handler1 = module.prebidBidsBackHandler__()[0];
      const handler2 = module.prebidBidsBackHandler__()[0];
      expect(handler1).to.be.ok;
      expect(handler1).to.equal(handler2);
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
      }) as prebidjs.IGumGumBidResponse;
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
          {
            'mobile-skin-slot': {
              bids: [gumgumBidResponse({ auid: 59 })]
            }
          },
          noopLogger
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should return `NoBlocking` if a gumgum mobile skin was found but cpm 0', () => {
        const skinConfigEffect = module.getConfigEffect(
          config,
          {
            'mobile-skin-slot': {
              bids: [{ ...gumgumBidResponse({ auid: 59 }), cpm: 0 }]
            }
          },
          noopLogger
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
      });

      it('should return `NoBlocking` if the gumgum format does not match was found', () => {
        const skinConfigEffect = module.getConfigEffect(
          config,
          {
            'mobile-skin-slot': {
              bids: [gumgumBidResponse('some markup'), gumgumBidResponse({ auid: 39 })]
            }
          },
          noopLogger
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
          {
            'mobile-skin-slot': {
              bids: [gumgumBidResponse({ auid: 59 })]
            }
          },
          noopLogger
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should return `BlockOtherSlots` if a gumgum mobile skin was found with markup', () => {
        const skinConfigEffect = module.getConfigEffect(
          config,
          {
            'mobile-skin-slot': {
              bids: [gumgumBidResponse('markup')]
            }
          },
          noopLogger
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
          {
            'wp-slot': {
              bids: [genericBidResponse('ix', 10.0)]
            }
          },
          noopLogger
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should return `NoBlocking` if a bid response was found but with cpm 0', () => {
        const skinConfigEffect = module.getConfigEffect(
          config,
          {
            'wp-slot': {
              bids: [genericBidResponse('pubmatic', 0)]
            }
          },
          noopLogger
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
      });

      it('should return `BlockSkinSlot`if the skin bid is lower than the bids on the to-be-removed slots combined', () => {
        const skinConfigEffect = module.getConfigEffect(
          config,
          {
            'wp-slot': {
              bids: [genericBidResponse('pubmatic', 5)]
            },
            'sky-slot': {
              bids: [genericBidResponse('openx', 6.5), genericBidResponse('openx', 0.49)]
            }
          },
          noopLogger
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
            {
              'wp-slot': {
                bids: [genericBidResponse(bidder, 10.0)]
              }
            },
            noopLogger
          );

          expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
        });

        it(`should return \`NoBlocking\` if a ${bidder} response was found but with cpm 0`, () => {
          const skinConfigEffect = module.getConfigEffect(
            config,
            {
              'wp-slot': {
                bids: [genericBidResponse(bidder, 0)]
              }
            },
            noopLogger
          );

          expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
        });
      })
    );

    describe('enableCpmComparison: getConfigEffect', () => {
      it('should return `BlockOtherSlots` if the skin bid is higher than the bids on the to-be-removed slots combined', () => {
        const configuredModule = skinModule({ configs: [] });

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
          {
            'wp-slot': {
              bids: [dspxBidResponse(1.5), genericBidResponse('openx', 1)]
            },
            'sky-slot': {
              bids: [genericBidResponse('openx', 0.5), genericBidResponse('openx', 0.49)]
            },
            'sky-slot-2': {
              bids: [genericBidResponse('openx', 0.01), genericBidResponse('openx', 0)]
            }
          },
          noopLogger
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should return `BlockSkinSlot` if the skin bid is lower than the bids on the to-be-removed slots combined', () => {
        const configuredModule = skinModule({ configs: [] });

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
          {
            'wp-slot': {
              bids: [dspxBidResponse(1.5), genericBidResponse('openx', 1)]
            },
            'sky-slot': {
              bids: [genericBidResponse('openx', 1.5), genericBidResponse('openx', 0.49)]
            },
            'sky-slot-2': {
              bids: [genericBidResponse('openx', 0.01), genericBidResponse('openx', 0)]
            }
          },
          noopLogger
        );

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockSkinSlot);
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
        const skinModuleConfig = modulesConfig({
          configs: [wallpaperConfig, mobileSkinConfig]
        }).skin!;
        const configuredModule = skinModule(skinModuleConfig);

        // select desktop wallpaper
        const wpConfig = configuredModule.selectConfig(
          skinModuleConfig,
          {
            'wp-slot': { bids: [gumgumBidResponse('<h1>skin</h1>')] }
          },
          noopLogger
        );
        expect(wpConfig?.skinConfig).to.equal(wallpaperConfig);
        expect(wpConfig?.configEffect).to.equal(SkinConfigEffect.BlockOtherSlots);

        // select mobile skin
        const mobileConfig = configuredModule.selectConfig(
          skinModuleConfig,
          {
            'mobile-sticky': { bids: [gumgumBidResponse({ auid: 59 })] }
          },
          noopLogger
        );
        expect(mobileConfig?.skinConfig).to.equal(mobileSkinConfig);
        expect(mobileConfig?.configEffect).to.equal(SkinConfigEffect.BlockOtherSlots);

        // select wallpaper config skin
        const wp2Config = configuredModule.selectConfig(
          skinModuleConfig,
          {
            'wp-slot': { bids: [gumgumBidResponse('wp'), gumgumBidResponse('mt')] }
          },
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

        const skinModuleConfig = modulesConfig({
          configs: [config]
        }).skin!;
        const configuredModule = skinModule(skinModuleConfig);

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
          skinModuleConfig,
          bidResponses,
          noopLogger
        );

        expect(skinConfig?.skinConfig).to.equal(config);
        expect(skinConfig?.configEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
        expect(trackSkinCpmLow).to.not.have.been.called;
      });
    });

    describe('destroySkinSlot', () => {
      let slots: AdSlot[] = [];
      let slotDefinitions: MoliRuntime.SlotDefinition[] = [];

      const moliConfig = (): MoliConfig => ({
        slots: slots,
        prebid: prebidConfig,
        schain: dummySchainConfig
      });

      beforeEach(() => {
        slots = createAdSlots(jsDomWindow, ['wp-slot', 'sky-slot']);
        slotDefinitions = slots.map(slot => ({
          moliSlot: slot,
          adSlot: createGoogleAdSlot(slot.domId),
          filterSupportedSizes: () => []
        }));
      });

      it('should not destroy the skin ad slot if unset', () => {
        const module = skinModule({
          configs: [
            {
              formatFilter: [{ bidder: prebidjs.DSPX }],
              skinAdSlotDomId: 'wp-slot',
              blockedAdSlotDomIds: ['sky-slot'],
              hideSkinAdSlot: false,
              hideBlockedSlots: false,
              enableCpmComparison: false
            }
          ]
        });

        const destroyAdSlotSpy = sandbox.spy(jsDomWindow.googletag, 'destroySlots');

        const bidsBackHandler = module.prebidBidsBackHandler__()[0];
        expect(bidsBackHandler).to.be.ok;
        bidsBackHandler(adPipelineContext(moliConfig()), {}, slotDefinitions);

        expect(destroyAdSlotSpy).to.have.not.been.called;
      });

      it('should not destroy the skin ad slot if set to false', () => {
        const module = skinModule({
          configs: [
            {
              formatFilter: [{ bidder: prebidjs.DSPX }],
              skinAdSlotDomId: 'wp-slot',
              blockedAdSlotDomIds: ['sky-slot'],
              hideSkinAdSlot: false,
              hideBlockedSlots: false,
              enableCpmComparison: false,
              destroySkinSlot: false
            }
          ]
        });

        const destroyAdSlotSpy = sandbox.spy(jsDomWindow.googletag, 'destroySlots');

        const bidsBackHandler = module.prebidBidsBackHandler__()[0];
        expect(bidsBackHandler).to.be.ok;
        bidsBackHandler(adPipelineContext(moliConfig()), {}, slotDefinitions);

        expect(destroyAdSlotSpy).to.have.not.been.called;
      });

      it('should not destroy the skin ad slot if set to true for a bidder and the other delivers', () => {
        const module = skinModule({
          configs: [
            {
              formatFilter: [{ bidder: prebidjs.Visx }],
              skinAdSlotDomId: 'wp-slot',
              blockedAdSlotDomIds: ['sky-slot'],
              hideSkinAdSlot: false,
              hideBlockedSlots: false,
              enableCpmComparison: false,
              destroySkinSlot: true
            },
            {
              formatFilter: [{ bidder: prebidjs.DSPX }],
              skinAdSlotDomId: 'wp-slot',
              blockedAdSlotDomIds: ['sky-slot'],
              hideSkinAdSlot: false,
              hideBlockedSlots: false,
              enableCpmComparison: false,
              destroySkinSlot: true
            }
          ]
        });

        const destroyAdSlotSpy = sandbox.spy(jsDomWindow.googletag, 'destroySlots');

        const bidsBackHandler = module.prebidBidsBackHandler__()[0];
        expect(bidsBackHandler).to.be.ok;
        bidsBackHandler(
          adPipelineContext(moliConfig()),
          {
            'wp-slot': {
              bids: [dspxBidResponse(1)]
            }
          },
          slotDefinitions
        );

        // only the sky slot should be destroyed
        expect(destroyAdSlotSpy).to.have.been.calledOnceWithExactly(
          Sinon.match.array.deepEquals(
            slotDefinitions
              .filter(slot => slot.moliSlot.domId === 'sky-slot')
              .map(slot => slot.adSlot)
          )
        );
      });

      it('should destroy the skin ad slot if set to true', () => {
        const module = skinModule({
          configs: [
            {
              formatFilter: [{ bidder: prebidjs.DSPX }],
              skinAdSlotDomId: 'wp-slot',
              blockedAdSlotDomIds: ['sky-slot'],
              hideSkinAdSlot: false,
              hideBlockedSlots: false,
              enableCpmComparison: false,
              destroySkinSlot: true
            }
          ]
        });

        const destroyAdSlotSpy = sandbox.spy(jsDomWindow.googletag, 'destroySlots');

        const bidsBackHandler = module.prebidBidsBackHandler__()[0];
        expect(bidsBackHandler).to.be.ok;
        bidsBackHandler(adPipelineContext(moliConfig()), {}, slotDefinitions);

        expect(destroyAdSlotSpy).to.have.been.calledOnce;
        expect(destroyAdSlotSpy).to.have.been.calledOnceWithExactly(
          Sinon.match.array.deepEquals(
            slotDefinitions
              .filter(slot => slot.moliSlot.domId === 'wp-slot')
              .map(slot => slot.adSlot)
          )
        );
      });

      it('should destroy the skin ad slot only once', () => {
        const module = skinModule({
          configs: [
            {
              formatFilter: [{ bidder: prebidjs.DSPX }],
              skinAdSlotDomId: 'wp-slot',
              blockedAdSlotDomIds: ['sky-slot'],
              hideSkinAdSlot: false,
              hideBlockedSlots: false,
              enableCpmComparison: false,
              destroySkinSlot: true
            },
            {
              formatFilter: [{ bidder: prebidjs.Visx }],
              skinAdSlotDomId: 'wp-slot',
              blockedAdSlotDomIds: ['sky-slot'],
              hideSkinAdSlot: false,
              hideBlockedSlots: false,
              enableCpmComparison: false,
              destroySkinSlot: true
            }
          ]
        });

        const destroyAdSlotSpy = sandbox.spy(jsDomWindow.googletag, 'destroySlots');

        const bidsBackHandler = module.prebidBidsBackHandler__()[0];
        expect(bidsBackHandler).to.be.ok;
        bidsBackHandler(adPipelineContext(moliConfig()), {}, slotDefinitions);

        expect(destroyAdSlotSpy).to.have.been.calledOnce;
        expect(destroyAdSlotSpy).to.have.been.calledOnceWithExactly(
          Sinon.match.array.deepEquals(
            slotDefinitions
              .filter(slot => slot.moliSlot.domId === 'wp-slot')
              .map(slot => slot.adSlot)
          )
        );
      });
    });

    describe('targeting', () => {
      const skinConfig: modules.skin.SkinConfig = {
        formatFilter: [{ bidder: prebidjs.DSPX }],
        skinAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: ['sky-slot'],
        hideSkinAdSlot: false,
        hideBlockedSlots: false,
        enableCpmComparison: false,
        targeting: {
          key: 'skin'
        }
      };

      const slotDefinitions = createAdSlots(jsDomWindow, ['wp-slot', 'sky-slot']).map(
        slot =>
          ({
            moliSlot: slot,
            adSlot: createGoogleAdSlot(slot.domId)
          }) as MoliRuntime.SlotDefinition
      );

      it('should set page level targeting if a skin is selected', () => {
        const setTargetingSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'setTargeting');
        const configuredModule = skinModule({ configs: [skinConfig] });
        const runner = configuredModule.runSkinConfigs({
          enabled: true,
          configs: [skinConfig]
        });
        runner(
          adPipelineContext(),
          {
            'wp-slot': { bids: [dspxBidResponse(1)] },
            'sky-slot': { bids: [genericBidResponse('openx', 0.5)] }
          },
          slotDefinitions
        );

        expect(setTargetingSpy).to.have.been.calledOnce;
        expect(setTargetingSpy).to.have.been.calledWithExactly('skin', '1');
      });

      it('should set page level targeting with the given value', () => {
        const setTargetingSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'setTargeting');

        const skinConfigWithValue: modules.skin.SkinConfig = {
          ...skinConfig,
          targeting: {
            key: 'skin',
            value: 'foo'
          }
        };
        const configuredModule = skinModule({ configs: [skinConfigWithValue] });
        const runner = configuredModule.runSkinConfigs({
          enabled: true,
          configs: [skinConfigWithValue]
        });
        runner(
          adPipelineContext(),
          {
            'wp-slot': { bids: [dspxBidResponse(1)] },
            'sky-slot': { bids: [genericBidResponse('openx', 0.5)] }
          },
          slotDefinitions
        );

        expect(setTargetingSpy).to.have.been.calledOnce;
        expect(setTargetingSpy).to.have.been.calledWithExactly('skin', 'foo');
      });

      it('should not set page level targeting if no skin is selected', () => {
        const setTargetingSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'setTargeting');
        const configuredModule = skinModule({ configs: [skinConfig] });

        const runner = configuredModule.runSkinConfigs({
          enabled: true,
          configs: [skinConfig]
        });
        runner(
          adPipelineContext(),
          {
            'wp-slot': { bids: [] },
            'sky-slot': { bids: [genericBidResponse('openx', 1.5)] }
          },
          slotDefinitions
        );

        expect(setTargetingSpy).to.have.not.been.called;
      });
    });
  });

  describe('filterHighestNonSkinBid', () => {
    it('should return an empty array if there are no bids', () => {
      const nonSkinBids = filterHighestNonSkinBid({}, []);
      expect(nonSkinBids).to.deep.equal([]);
    });

    it('should return an empty array if there are bids on an unblocked slot', () => {
      const nonSkinBids = filterHighestNonSkinBid(
        {
          'sky-slot': { bids: [genericBidResponse('openx', 1)] }
        },
        ['another-slot']
      );
      expect(nonSkinBids).to.deep.equal([]);
    });

    it('should return a single bid if there is one', () => {
      const blockedSlotDomId = 'sky-slot';
      const bidResponse = genericBidResponse('openx', 1);
      const nonSkinBids = filterHighestNonSkinBid(
        {
          [blockedSlotDomId]: { bids: [bidResponse] }
        },
        [blockedSlotDomId]
      );
      expect(nonSkinBids).to.have.length(1);
      expect(nonSkinBids[0]).to.deep.equal(bidResponse);
    });

    it('should return the highest bid if there are multiple', () => {
      const blockedSlotDomId = 'sky-slot';
      const bidResponse1 = genericBidResponse('openx', 1);
      const bidResponse2 = genericBidResponse('openx', 2);
      const nonSkinBids = filterHighestNonSkinBid(
        {
          [blockedSlotDomId]: { bids: [bidResponse1, bidResponse2] }
        },
        [blockedSlotDomId]
      );
      expect(nonSkinBids).to.have.length(1);
      expect(nonSkinBids[0]).to.deep.equal(bidResponse2);
    });
  });
});
