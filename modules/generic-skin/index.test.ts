import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { googletag, Moli, prebidjs } from '@highfivve/ad-tag';
import { newNoopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { moliPrebidTestConfig, pbjsTestConfig } from '@highfivve/ad-tag/lib/stubs/prebidjsStubs';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import { FormatFilter, Skin, SkinConfig, SkinConfigEffect } from './index';
import IBidResponsesMap = prebidjs.IBidResponsesMap;
import { createGoogletagStub } from '@highfivve/ad-tag/lib/stubs/googletagStubs';
import { dummySchainConfig } from '@highfivve/ad-tag/lib/stubs/schainStubs';
import MoliWindow = Moli.MoliWindow;

// setup sinon-chai
use(sinonChai);

/**
 * All bidders that require no additional configuration other than the bidder code
 */
type SimpleFormatFilterBidder = Exclude<FormatFilter['bidder'], 'gumgum' | '*'>;

describe('Skin Module', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window & googletag.IGoogleTagWindow & MoliWindow = dom.window as any;
  jsDomWindow.googletag = createGoogletagStub();

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    jsDomWindow.googletag = createGoogletagStub();
    sandbox.reset();
  });

  const createAdSlots = (window: Window, domIds: string[]): Moli.AdSlot[] => {
    return domIds.map(domId => {
      const div = window.document.createElement('div');
      div.id = domId;
      window.document.body.appendChild(div);

      const slot: Moli.AdSlot = {
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
    } as googletag.IAdSlot);

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

  describe('init', () => {
    it('should set the prebidResponse listener', () => {
      const noopLogger = newNoopLogger();
      const module = new Skin(
        {
          configs: [
            {
              formatFilter: [],
              skinAdSlotDomId: 'wp-slot',
              blockedAdSlotDomIds: ['sky-slot'],
              hideSkinAdSlot: false,
              hideBlockedSlots: false,
              enableCpmComparison: false
            }
          ]
        },
        jsDomWindow
      );

      const slots = createAdSlots(jsDomWindow, ['wp-slot', 'sky-slot']);

      const initSpy = sandbox.spy(module, 'init');
      const errorLogSpy = sandbox.spy(noopLogger, 'error');

      const config: Moli.MoliConfig = {
        slots: slots,
        logger: noopLogger,
        prebid: { config: pbjsTestConfig, schain: { nodes: [] } },
        schain: dummySchainConfig
      };

      module.init(config);

      expect(initSpy).to.have.been.calledOnceWithExactly(config);
      expect(errorLogSpy).to.have.not.been.called;

      expect(config.prebid!.listener).is.ok;
    });

    it('should fail if not all slots are available in the config', () => {
      const noopLogger = newNoopLogger();
      const module = new Skin(
        {
          configs: [
            {
              formatFilter: [],
              skinAdSlotDomId: 'wp-slot',
              blockedAdSlotDomIds: ['sky-slot'],
              hideSkinAdSlot: false,
              hideBlockedSlots: false,
              enableCpmComparison: false
            }
          ]
        },
        jsDomWindow
      );

      const slots = createAdSlots(jsDomWindow, ['wp-slot']);

      const initSpy = sandbox.spy(module, 'init');
      const errorLogSpy = sandbox.spy(noopLogger, 'error');

      const config: Moli.MoliConfig = {
        slots: slots,
        logger: noopLogger,
        prebid: { config: pbjsTestConfig, schain: { nodes: [] } },
        schain: dummySchainConfig
      };

      module.init(config);

      expect(initSpy).to.have.been.calledOnceWithExactly(config);
      expect(errorLogSpy).to.have.been.called;

      expect(config.prebid!.listener).is.undefined;
    });
  });

  describe('checkConfig filter evaluation', () => {
    const module = new Skin(
      {
        configs: []
      },
      jsDomWindow
    );

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
      const config: SkinConfig = {
        formatFilter: [{ bidder: 'gumgum', auid: 59 }],
        skinAdSlotDomId: 'mobile-skin-slot',
        blockedAdSlotDomIds: ['sky-slot'],
        hideSkinAdSlot: false,
        hideBlockedSlots: false,
        enableCpmComparison: false
      };

      it('should return `BlockOtherSlots` if a gumgum mobile skin was found', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'mobile-skin-slot': {
            bids: [gumgumBidResponse({ auid: 59 })]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should return `NoBlocking` if a gumgum mobile skin was found but cpm 0', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'mobile-skin-slot': {
            bids: [{ ...gumgumBidResponse({ auid: 59 }), cpm: 0 }]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
      });

      it('should return `NoBlocking` if the gumgum format does not match was found', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'mobile-skin-slot': {
            bids: [gumgumBidResponse('some markup'), gumgumBidResponse({ auid: 39 })]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
      });
    });

    describe('gumgum no auid', () => {
      const config: SkinConfig = {
        formatFilter: [{ bidder: 'gumgum' }],
        skinAdSlotDomId: 'mobile-skin-slot',
        blockedAdSlotDomIds: ['sky-slot'],
        hideSkinAdSlot: false,
        hideBlockedSlots: false,
        enableCpmComparison: false
      };

      it('should return `BlockOtherSlots` if a gumgum mobile skin was found', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'mobile-skin-slot': {
            bids: [gumgumBidResponse({ auid: 59 })]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should return `BlockOtherSlots` if a gumgum mobile skin was found with markup', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'mobile-skin-slot': {
            bids: [gumgumBidResponse('markup')]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });
    });

    describe('* ( AllFormatFilter )', () => {
      const config: SkinConfig = {
        formatFilter: [{ bidder: '*' }],
        skinAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: ['sky-slot'],
        hideSkinAdSlot: false,
        hideBlockedSlots: false,
        enableCpmComparison: true
      };
      it('should return `BlockOtherSlots` if any response was found', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'wp-slot': {
            bids: [genericBidResponse('ix', 10.0)]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should return `NoBlocking` if a bid response was found but with cpm 0', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'wp-slot': {
            bids: [genericBidResponse('pubmatic', 0)]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
      });

      it('should return `BlockSkinSlot`if the skin bid is lower than the bids on the to-be-removed slots combined', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'wp-slot': {
            bids: [genericBidResponse('pubmatic', 5)]
          },
          'sky-slot': {
            bids: [genericBidResponse('openx', 6.5), genericBidResponse('openx', 0.49)]
          }
        });

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
        const config: SkinConfig = {
          formatFilter: [{ bidder: bidder }],
          skinAdSlotDomId: 'wp-slot',
          blockedAdSlotDomIds: ['sky-slot'],
          hideSkinAdSlot: false,
          hideBlockedSlots: false,
          enableCpmComparison: false
        };
        it(`should return \`BlockOtherSlots\` if a ${bidder} response was found`, () => {
          const skinConfigEffect = module.getConfigEffect(config, {
            'wp-slot': {
              bids: [genericBidResponse(bidder, 10.0)]
            }
          });

          expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
        });

        it(`should return \`NoBlocking\` if a ${bidder} response was found but with cpm 0`, () => {
          const skinConfigEffect = module.getConfigEffect(config, {
            'wp-slot': {
              bids: [genericBidResponse(bidder, 0)]
            }
          });

          expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
        });
      })
    );

    describe('enableCpmComparison: getConfigEffect', () => {
      const trackSkinCpmLow = sandbox.stub();

      beforeEach(() => trackSkinCpmLow.reset());

      it('should return `BlockOtherSlots`, but log the result if the skin bid is low but the comparison is disabled', () => {
        const configuredModule = new Skin(
          {
            configs: [],
            trackSkinCpmLow
          },
          jsDomWindow
        );

        const config: SkinConfig = {
          formatFilter: [{ bidder: prebidjs.GumGum }],
          skinAdSlotDomId: 'wp-slot',
          blockedAdSlotDomIds: ['sky-slot', 'sky-slot-2', 'sky-slot-3'],
          hideSkinAdSlot: false,
          hideBlockedSlots: false,
          enableCpmComparison: false
        };

        const bidResponses: IBidResponsesMap = {
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

        const skinConfigEffect = configuredModule.getConfigEffect(config, bidResponses);
        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
        expect(trackSkinCpmLow).to.have.been.calledOnceWithExactly(
          {
            skin: 1.5,
            combinedNonSkinSlots: 1.51
          },
          config,
          { ...gumgumBidResponse('<h1>skin</h1>'), cpm: 1.5 }
        );
      });

      it('should return `BlockOtherSlots` if the skin bid is higher than the bids on the to-be-removed slots combined', () => {
        const configuredModule = new Skin(
          {
            configs: []
          },
          jsDomWindow
        );

        const config: SkinConfig = {
          formatFilter: [{ bidder: prebidjs.DSPX }],
          skinAdSlotDomId: 'wp-slot',
          blockedAdSlotDomIds: ['sky-slot', 'sky-slot-2'],
          hideSkinAdSlot: false,
          hideBlockedSlots: false,
          enableCpmComparison: true
        };

        const skinConfigEffect = configuredModule.getConfigEffect(config, {
          'wp-slot': {
            bids: [dspxBidResponse(1.5), genericBidResponse('openx', 1)]
          },
          'sky-slot': {
            bids: [genericBidResponse('openx', 0.5), genericBidResponse('openx', 0.49)]
          },
          'sky-slot-2': {
            bids: [genericBidResponse('openx', 0.01), genericBidResponse('openx', 0)]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should return `BlockSkinSlot` if the skin bid is lower than the bids on the to-be-removed slots combined', () => {
        const configuredModule = new Skin(
          {
            configs: [],
            trackSkinCpmLow
          },
          jsDomWindow
        );

        const config: SkinConfig = {
          formatFilter: [{ bidder: prebidjs.DSPX }],
          skinAdSlotDomId: 'wp-slot',
          blockedAdSlotDomIds: ['sky-slot', 'sky-slot-2'],
          hideSkinAdSlot: false,
          hideBlockedSlots: false,
          enableCpmComparison: true
        };

        const skinConfigEffect = configuredModule.getConfigEffect(config, {
          'wp-slot': {
            bids: [dspxBidResponse(1.5), genericBidResponse('openx', 1)]
          },
          'sky-slot': {
            bids: [genericBidResponse('openx', 1.5), genericBidResponse('openx', 0.49)]
          },
          'sky-slot-2': {
            bids: [genericBidResponse('openx', 0.01), genericBidResponse('openx', 0)]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockSkinSlot);
        expect(trackSkinCpmLow).to.have.been.calledOnce;
      });
    });

    describe('selectConfig filter selection', () => {
      const wallpaperConfig: SkinConfig = {
        formatFilter: [{ bidder: prebidjs.GumGum }],
        skinAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: ['sky-slot'],
        hideSkinAdSlot: false,
        hideBlockedSlots: false,
        enableCpmComparison: false
      };

      const mobileSkinConfig: SkinConfig = {
        formatFilter: [{ bidder: prebidjs.GumGum, auid: 59 }],
        skinAdSlotDomId: 'mobile-sticky',
        blockedAdSlotDomIds: ['content-1'],
        hideSkinAdSlot: false,
        hideBlockedSlots: false,
        enableCpmComparison: false
      };

      it('should select the first rule that applies', () => {
        const configuredModule = new Skin(
          {
            configs: [wallpaperConfig, mobileSkinConfig]
          },
          jsDomWindow
        );

        // select desktop wallpaper
        const wpConfig = configuredModule.selectConfig({
          'wp-slot': { bids: [gumgumBidResponse('<h1>skin</h1>')] }
        });
        expect(wpConfig?.skinConfig).to.equal(wallpaperConfig);
        expect(wpConfig?.configEffect).to.equal(SkinConfigEffect.BlockOtherSlots);

        // select mobile skin
        const mobileConfig = configuredModule.selectConfig({
          'mobile-sticky': { bids: [gumgumBidResponse({ auid: 59 })] }
        });
        expect(mobileConfig?.skinConfig).to.equal(mobileSkinConfig);
        expect(mobileConfig?.configEffect).to.equal(SkinConfigEffect.BlockOtherSlots);

        // select wallpaper config skin
        const wp2Config = configuredModule.selectConfig({
          'wp-slot': { bids: [gumgumBidResponse('wp'), gumgumBidResponse('mt')] }
        });
        expect(wp2Config?.skinConfig).to.equal(wallpaperConfig);
        expect(wp2Config?.configEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should select the highest skin bid if there are multiple skin bids', () => {
        const trackSkinCpmLow = sandbox.stub();

        const config: SkinConfig = {
          formatFilter: [{ bidder: prebidjs.GumGum }, { bidder: prebidjs.DSPX }],
          skinAdSlotDomId: 'wp-slot',
          blockedAdSlotDomIds: ['sky-slot', 'sky-slot-2', 'sky-slot-3'],
          hideSkinAdSlot: false,
          hideBlockedSlots: false,
          enableCpmComparison: true
        };
        const configuredModule = new Skin(
          {
            configs: [config],
            trackSkinCpmLow
          },
          jsDomWindow
        );

        // gumgum has 1.50 cpm
        // other bids combined have 1.51 cpm
        // dspx has 1.52 cpm and will be selected
        const bidResponses: IBidResponsesMap = {
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

        const skinConfig = configuredModule.selectConfig(bidResponses);

        expect(skinConfig?.skinConfig).to.equal(config);
        expect(skinConfig?.configEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
        expect(trackSkinCpmLow).to.not.have.been.called;
      });
    });

    describe('destroySkinSlot', () => {
      let slots: Moli.AdSlot[] = [];
      let slotDefinitions: Moli.SlotDefinition[] = [];

      beforeEach(() => {
        slots = createAdSlots(jsDomWindow, ['wp-slot', 'sky-slot']);
        slotDefinitions = slots.map(slot => ({
          moliSlot: slot,
          adSlot: {
            getSlotElementId: () => slot.domId
          } as googletag.IAdSlot,
          filterSupportedSizes: () => []
        }));
      });

      it('should not destroy the skin ad slot if unset', () => {
        const module = new Skin(
          {
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
          },
          jsDomWindow
        );

        const destroyAdSlotSpy = sandbox.spy(jsDomWindow.googletag, 'destroySlots');
        const prebidConfig: Moli.headerbidding.PrebidConfig = {
          config: pbjsTestConfig,
          schain: { nodes: [] }
        };

        const config: Moli.MoliConfig = {
          slots: slots,
          prebid: prebidConfig,
          schain: dummySchainConfig
        };
        module.init(config);

        expect(config.prebid?.listener).to.be.ok;

        const preSetTargetingForGPTAsync = (
          config.prebid!.listener as Moli.headerbidding.PrebidListener
        ).preSetTargetingForGPTAsync!;

        preSetTargetingForGPTAsync({}, false, slotDefinitions);
        expect(destroyAdSlotSpy).to.have.not.been.called;
      });

      it('should not destroy the skin ad slot if set to false', () => {
        const module = new Skin(
          {
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
          },
          jsDomWindow
        );

        const destroyAdSlotSpy = sandbox.spy(jsDomWindow.googletag, 'destroySlots');
        const prebidConfig: Moli.headerbidding.PrebidConfig = {
          config: pbjsTestConfig,
          schain: { nodes: [] }
        };

        const config: Moli.MoliConfig = {
          slots: slots,
          prebid: prebidConfig,
          schain: dummySchainConfig
        };
        module.init(config);

        expect(config.prebid?.listener).to.be.ok;

        const preSetTargetingForGPTAsync = (
          config.prebid!.listener as Moli.headerbidding.PrebidListener
        ).preSetTargetingForGPTAsync!;

        preSetTargetingForGPTAsync({}, false, slotDefinitions);
        expect(destroyAdSlotSpy).to.have.not.been.called;
      });

      it('should not destroy the skin ad slot if set to true for a bidder and the other delivers', () => {
        const module = new Skin(
          {
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
          },
          jsDomWindow
        );

        const destroyAdSlotSpy = sandbox.spy(jsDomWindow.googletag, 'destroySlots');
        const prebidConfig: Moli.headerbidding.PrebidConfig = {
          config: pbjsTestConfig,
          schain: { nodes: [] }
        };

        const config: Moli.MoliConfig = {
          slots: slots,
          prebid: prebidConfig,
          schain: dummySchainConfig
        };
        module.init(config);

        expect(config.prebid?.listener).to.be.ok;

        const preSetTargetingForGPTAsync = (
          config.prebid!.listener as Moli.headerbidding.PrebidListener
        ).preSetTargetingForGPTAsync!;

        preSetTargetingForGPTAsync(
          {
            'wp-slot': {
              bids: [dspxBidResponse(1)]
            }
          },
          false,
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
        const module = new Skin(
          {
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
          },
          jsDomWindow
        );

        const destroyAdSlotSpy = sandbox.spy(jsDomWindow.googletag, 'destroySlots');
        const prebidConfig: Moli.headerbidding.PrebidConfig = {
          config: pbjsTestConfig,
          schain: { nodes: [] }
        };

        const config: Moli.MoliConfig = {
          slots: slots,
          prebid: prebidConfig,
          schain: dummySchainConfig
        };
        module.init(config);

        expect(config.prebid?.listener).to.be.ok;

        const preSetTargetingForGPTAsync = (
          config.prebid!.listener as Moli.headerbidding.PrebidListener
        ).preSetTargetingForGPTAsync!;

        preSetTargetingForGPTAsync({}, false, slotDefinitions);
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
        const module = new Skin(
          {
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
          },
          jsDomWindow
        );

        const destroyAdSlotSpy = sandbox.spy(jsDomWindow.googletag, 'destroySlots');
        const prebidConfig: Moli.headerbidding.PrebidConfig = {
          config: pbjsTestConfig,
          schain: { nodes: [] }
        };

        const config: Moli.MoliConfig = {
          slots: slots,
          prebid: prebidConfig,
          schain: dummySchainConfig
        };
        module.init(config);

        expect(config.prebid?.listener).to.be.ok;

        const preSetTargetingForGPTAsync = (
          config.prebid!.listener as Moli.headerbidding.PrebidListener
        ).preSetTargetingForGPTAsync!;

        preSetTargetingForGPTAsync({}, false, slotDefinitions);
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
      const skinConfig: SkinConfig = {
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

      const slots = createAdSlots(jsDomWindow, ['wp-slot', 'sky-slot']);
      const slotDefinitions = slots.map(
        slot =>
          ({
            moliSlot: slot,
            adSlot: createGoogleAdSlot(slot.domId)
          } as Moli.SlotDefinition)
      );

      const skinModule = (moduleConfig: { configs: SkinConfig[] }) => {
        const module = new Skin(moduleConfig, jsDomWindow);

        const config: Moli.MoliConfig = {
          slots: slots,
          prebid: { ...moliPrebidTestConfig },
          schain: dummySchainConfig
        };
        module.init(config);

        expect(config.prebid?.listener).to.be.ok;

        const preSetTargetingForGPTAsync = (
          config.prebid!.listener as Moli.headerbidding.PrebidListener
        ).preSetTargetingForGPTAsync!;

        return { preSetTargetingForGPTAsync };
      };

      it('should set page level targeting if a skin is selected', () => {
        const setTargetingSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'setTargeting');
        const { preSetTargetingForGPTAsync } = skinModule({ configs: [skinConfig] });
        preSetTargetingForGPTAsync(
          {
            'wp-slot': { bids: [dspxBidResponse(1)] },
            'sky-slot': { bids: [genericBidResponse('openx', 0.5)] }
          },
          false,
          slotDefinitions
        );

        expect(setTargetingSpy).to.have.been.calledOnce;
        expect(setTargetingSpy).to.have.been.calledWithExactly('skin', '1');
      });

      it('should set page level targeting with the given value', () => {
        const setTargetingSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'setTargeting');

        const skinConfigWithValue: SkinConfig = {
          ...skinConfig,
          targeting: {
            key: 'skin',
            value: 'foo'
          }
        };
        const { preSetTargetingForGPTAsync } = skinModule({ configs: [skinConfigWithValue] });
        preSetTargetingForGPTAsync(
          {
            'wp-slot': { bids: [dspxBidResponse(1)] },
            'sky-slot': { bids: [genericBidResponse('openx', 0.5)] }
          },
          false,
          slotDefinitions
        );

        expect(setTargetingSpy).to.have.been.calledOnce;
        expect(setTargetingSpy).to.have.been.calledWithExactly('skin', 'foo');
      });

      it('should not set page level targeting if no skin is selected', () => {
        const setTargetingSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'setTargeting');

        const { preSetTargetingForGPTAsync } = skinModule({ configs: [skinConfig] });
        preSetTargetingForGPTAsync(
          {
            'wp-slot': { bids: [] },
            'sky-slot': { bids: [genericBidResponse('openx', 1.5)] }
          },
          false,
          slotDefinitions
        );

        expect(setTargetingSpy).to.have.not.been.called;
      });
    });
  });
});
