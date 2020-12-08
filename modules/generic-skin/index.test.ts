import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

import { createAssetLoaderService, googletag, Moli, prebidjs } from '@highfivve/ad-tag';
import { newNoopLogger } from '@highfivve/ad-tag/tests/ts/stubs/moliStubs';
import { pbjsTestConfig } from '@highfivve/ad-tag/tests/ts/stubs/prebidjsStubs';
import { createDom } from '@highfivve/ad-tag/tests/ts/stubs/browserEnvSetup';

import Skin, { ISkinConfig, SkinConfigEffect } from './index';
import IBidResponsesMap = prebidjs.IBidResponsesMap;

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('Skin Module', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window & googletag.IGoogleTagWindow = dom.window as any;

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
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

  const dpsxBidResponse = (cpm: number): prebidjs.IGenericBidResponse => {
    return {
      bidder: prebidjs.DSPX,
      cpm: cpm,
      adId: '',
      height: 1,
      width: 1,
      mediaType: 'banner',
      source: 'client'
    };
  };

  const bidWithCpmOf = (cpm: number): prebidjs.IGenericBidResponse => ({
    bidder: prebidjs.AppNexus,
    cpm,
    adId: '',
    height: 1,
    width: 1,
    mediaType: 'banner',
    source: 'client'
  });

  describe('init', () => {
    it('should set the prebidResponse listener', () => {
      const noopLogger = newNoopLogger();
      const assetLoaderService = createAssetLoaderService(jsDomWindow);
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
        prebid: { config: pbjsTestConfig }
      };

      module.init(config, assetLoaderService);

      expect(initSpy).to.have.been.calledOnceWithExactly(config, assetLoaderService);
      expect(errorLogSpy).to.have.not.been.called;

      expect(config.prebid!.listener).is.ok;
    });

    it('should fail if not all slots are available in the config', () => {
      const noopLogger = newNoopLogger();
      const assetLoaderService = createAssetLoaderService(jsDomWindow);
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
        prebid: { config: pbjsTestConfig }
      };

      module.init(config, assetLoaderService);

      expect(initSpy).to.have.been.calledOnceWithExactly(config, assetLoaderService);
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

    const jpBidResponse = (
      format: prebidjs.JustPremiumFormat
    ): prebidjs.IJustPremiumBidResponse => {
      return {
        bidder: prebidjs.JustPremium,
        format: format,
        adId: '',
        cpm: 10.0,
        height: 1,
        width: 1,
        mediaType: 'banner',
        source: 'client'
      };
    };

    describe('just premium wallpaper', () => {
      const config: ISkinConfig = {
        formatFilter: [{ bidder: 'justpremium', format: 'wp' }],
        skinAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: ['sky-slot'],
        hideSkinAdSlot: false,
        hideBlockedSlots: false,
        enableCpmComparison: false
      };

      it('should return `BlockOtherSlots` if a just premium wallpaper was found', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'wp-slot': {
            bids: [jpBidResponse('wp')]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should return `NoBlocking` if a just premium wallpaper was found but cpm 0', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'wp-slot': {
            bids: [{ ...jpBidResponse('wp'), cpm: 0 }]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
      });

      it('should return `NoBlocking` if the just premium format does not match was found', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'wp-slot': {
            bids: [
              jpBidResponse('pu'),
              jpBidResponse('pd'),
              jpBidResponse('fa'),
              jpBidResponse('cf'),
              jpBidResponse('sa'),
              jpBidResponse('is'),
              jpBidResponse('mt'),
              jpBidResponse('ca')
            ]
          }
        });
        expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
      });
    });

    describe('just premium cascade ad', () => {
      const config: ISkinConfig = {
        formatFilter: [{ bidder: 'justpremium', format: 'ca' }],
        skinAdSlotDomId: 'cascade-ad-slot',
        blockedAdSlotDomIds: ['sky-slot'],
        hideSkinAdSlot: false,
        hideBlockedSlots: false,
        enableCpmComparison: false
      };

      it('should return `BlockOtherSlots` if a just premium mobile skin was found', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'cascade-ad-slot': {
            bids: [jpBidResponse('ca')]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should return `NoBlocking` if a just premium mobile skin was found but cpm 0', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'cascade-ad-slot': {
            bids: [{ ...jpBidResponse('ca'), cpm: 0 }]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
      });

      it('should return `NoBlocking` if the just premium format does not match was found', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'cascade-ad-slot': {
            bids: [
              jpBidResponse('pu'),
              jpBidResponse('pd'),
              jpBidResponse('fa'),
              jpBidResponse('cf'),
              jpBidResponse('sa'),
              jpBidResponse('is'),
              jpBidResponse('mt')
            ]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
      });
    });

    describe('just premium mobile skin', () => {
      const config: ISkinConfig = {
        formatFilter: [{ bidder: 'justpremium', format: 'mt' }],
        skinAdSlotDomId: 'mobile-skin-slot',
        blockedAdSlotDomIds: ['sky-slot'],
        hideSkinAdSlot: false,
        hideBlockedSlots: false,
        enableCpmComparison: false
      };

      it('should return `BlockOtherSlots` if a just premium mobile skin was found', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'mobile-skin-slot': {
            bids: [jpBidResponse('mt')]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should return `NoBlocking` if a just premium mobile skin was found but cpm 0', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'mobile-skin-slot': {
            bids: [{ ...jpBidResponse('mt'), cpm: 0 }]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
      });

      it('should return `NoBlocking` if the just premium format does not match was found', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'mobile-skin-slot': {
            bids: [
              jpBidResponse('pu'),
              jpBidResponse('pd'),
              jpBidResponse('fa'),
              jpBidResponse('cf'),
              jpBidResponse('sa'),
              jpBidResponse('is'),
              jpBidResponse('ca')
            ]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
      });
    });

    describe('dspx', () => {
      const config: ISkinConfig = {
        formatFilter: [{ bidder: 'dspx' }],
        skinAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: ['sky-slot'],
        hideSkinAdSlot: false,
        hideBlockedSlots: false,
        enableCpmComparison: false
      };

      it('should return `BlockOtherSlots` if a dspx response was found', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'wp-slot': {
            bids: [dpsxBidResponse(10.0)]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should return `NoBlocking` if a dspx response was found but with cpm 0', () => {
        const skinConfigEffect = module.getConfigEffect(config, {
          'wp-slot': {
            bids: [dpsxBidResponse(0)]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.NoBlocking);
      });
    });

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

        const config: ISkinConfig = {
          formatFilter: [{ bidder: prebidjs.JustPremium, format: prebidjs.JustPremiumWallpaper }],
          skinAdSlotDomId: 'wp-slot',
          blockedAdSlotDomIds: ['sky-slot', 'sky-slot-2', 'sky-slot-3'],
          hideSkinAdSlot: false,
          hideBlockedSlots: false,
          enableCpmComparison: false
        };

        const bidResponses: IBidResponsesMap = {
          'wp-slot': {
            bids: [{ ...jpBidResponse(prebidjs.JustPremiumWallpaper), cpm: 1.5 }, bidWithCpmOf(1)]
          },
          'sky-slot': {
            bids: [bidWithCpmOf(0.5), bidWithCpmOf(0.49)]
          },
          'sky-slot-2': {
            bids: [bidWithCpmOf(0.01), bidWithCpmOf(0)]
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
          { ...jpBidResponse(prebidjs.JustPremiumWallpaper), cpm: 1.5 }
        );
      });

      it('should return `BlockSkinSlot` if the skin bid is lower than the bids on the to-be-removed slots combined', () => {
        const configuredModule = new Skin(
          {
            configs: [],
            trackSkinCpmLow
          },
          jsDomWindow
        );

        const config: ISkinConfig = {
          formatFilter: [{ bidder: prebidjs.DSPX }],
          skinAdSlotDomId: 'wp-slot',
          blockedAdSlotDomIds: ['sky-slot', 'sky-slot-2'],
          hideSkinAdSlot: false,
          hideBlockedSlots: false,
          enableCpmComparison: true
        };

        const skinConfigEffect = configuredModule.getConfigEffect(config, {
          'wp-slot': {
            bids: [dpsxBidResponse(1.5), bidWithCpmOf(1)]
          },
          'sky-slot': {
            bids: [bidWithCpmOf(0.5), bidWithCpmOf(0.49)]
          },
          'sky-slot-2': {
            bids: [bidWithCpmOf(0.01), bidWithCpmOf(0)]
          }
        });

        expect(skinConfigEffect).to.equal(SkinConfigEffect.BlockSkinSlot);
        expect(trackSkinCpmLow).to.have.been.calledOnce;
      });
    });

    describe('selectConfig filter selection', () => {
      const wallpaperConfig: ISkinConfig = {
        formatFilter: [{ bidder: 'justpremium', format: 'wp' }],
        skinAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: ['sky-slot'],
        hideSkinAdSlot: false,
        hideBlockedSlots: false,
        enableCpmComparison: false
      };

      const mobileSkinConfig: ISkinConfig = {
        formatFilter: [{ bidder: 'justpremium', format: 'mt' }],
        skinAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: ['sky-slot'],
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
          'wp-slot': { bids: [jpBidResponse('wp')] }
        });
        expect(wpConfig?.skinConfig).to.equal(wallpaperConfig);
        expect(wpConfig?.configEffect).to.equal(SkinConfigEffect.BlockOtherSlots);

        // select mobile skin
        const mobileConfig = configuredModule.selectConfig({
          'wp-slot': { bids: [jpBidResponse('mt')] }
        });
        expect(mobileConfig?.skinConfig).to.equal(mobileSkinConfig);
        expect(mobileConfig?.configEffect).to.equal(SkinConfigEffect.BlockOtherSlots);

        // select wallpaper config skin
        const wp2Config = configuredModule.selectConfig({
          'wp-slot': { bids: [jpBidResponse('wp'), jpBidResponse('mt')] }
        });
        expect(wp2Config?.skinConfig).to.equal(wallpaperConfig);
        expect(wp2Config?.configEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
      });

      it('should select the highest skin bid if there are multiple skin bids', () => {
        const trackSkinCpmLow = sandbox.stub();

        const config: ISkinConfig = {
          formatFilter: [
            { bidder: prebidjs.JustPremium, format: prebidjs.JustPremiumWallpaper },
            { bidder: prebidjs.DSPX }
          ],
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

        // justpremium has 1.50 cpm
        // other bids combined have 1.51 cpm
        // dspx has 1.52 cpm and will be selected
        const bidResponses: IBidResponsesMap = {
          'wp-slot': {
            bids: [
              { ...jpBidResponse(prebidjs.JustPremiumWallpaper), cpm: 1.5 },
              dpsxBidResponse(1.52)
            ]
          },
          'sky-slot': {
            bids: [bidWithCpmOf(0.5), bidWithCpmOf(0.49)]
          },
          'sky-slot-2': {
            bids: [bidWithCpmOf(0.01), bidWithCpmOf(0)]
          },
          'sky-slot-3': undefined
        };

        const skinConfig = configuredModule.selectConfig(bidResponses);

        expect(skinConfig?.skinConfig).to.equal(config);
        expect(skinConfig?.configEffect).to.equal(SkinConfigEffect.BlockOtherSlots);
        expect(trackSkinCpmLow).to.not.have.been.called;
      });
    });
  });
});

// tslint:enable
