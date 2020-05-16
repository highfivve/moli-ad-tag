import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import Skin, { ISkinConfig } from './index';
import { Moli, prebidjs } from '@highfivve/ad-tag';
import { createMoliTag } from '@highfivve/ad-tag/source/ts/ads/moli';
import { consentConfig, newNoopLogger } from '@highfivve/ad-tag/tests/ts/stubs/moliStubs';
import { pbjsTestConfig } from '@highfivve/ad-tag/tests/ts/stubs/prebidjsStubs';
import { createDom } from '@highfivve/ad-tag/tests/ts/stubs/browserEnvSetup';


// setup sinon-chai
use(sinonChai);


// tslint:disable: no-unused-expression
describe('Skin Module', () => {

  const sandbox = Sinon.createSandbox();
  let dom = createDom();

  afterEach(() => {
    dom = createDom();
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

  describe('init', () => {

    it('should set the prebidResponse listener', () => {
      const moli = createMoliTag(dom.window);
      const noopLogger = newNoopLogger();
      const module = new Skin({
        configs: [
          {
            formatFilter: [],
            skinAdSlotDomId: 'wp-slot',
            blockedAdSlotDomIds: [ 'sky-slot' ],
            hideSkinAdSlot: false,
            hideBlockedSlots: false
          }
        ]
      }, dom.window);

      const slots = createAdSlots(dom.window, [ 'wp-slot', 'sky-slot' ]);

      const initSpy = sandbox.spy(module, 'init');
      const errorLogSpy = sandbox.spy(noopLogger, 'error');

      const config: Moli.MoliConfig = {
        slots: slots,
        consent: consentConfig,
        logger: noopLogger,
        prebid: { config: pbjsTestConfig },
        yieldOptimization: { provider: 'none' }
      };
      moli.registerModule(module);
      moli.configure(config);

      expect(initSpy).to.have.been.calledOnceWithExactly(config, moli.getAssetLoaderService());
      expect(errorLogSpy).to.have.not.been.called;

      expect(config.prebid!.listener).is.ok;
    });

    it('should fail if not all slots are available in the config', () => {
      const moli = createMoliTag(dom.window);
      const noopLogger = newNoopLogger();
      const module = new Skin({
        configs: [
          {
            formatFilter: [],
            skinAdSlotDomId: 'wp-slot',
            blockedAdSlotDomIds: [ 'sky-slot' ],
            hideSkinAdSlot: false,
            hideBlockedSlots: false
          }
        ]
      }, dom.window);

      const slots = createAdSlots(dom.window, [ 'wp-slot' ]);

      const initSpy = sandbox.spy(module, 'init');
      const errorLogSpy = sandbox.spy(noopLogger, 'error');

      const config: Moli.MoliConfig = {
        slots: slots,
        consent: consentConfig,
        logger: noopLogger,
        prebid: { config: pbjsTestConfig },
        yieldOptimization: { provider: 'none' }
      };
      moli.registerModule(module);
      moli.configure(config);

      expect(initSpy).to.have.been.calledOnceWithExactly(config, moli.getAssetLoaderService());
      expect(errorLogSpy).to.have.been.called;

      expect(config.prebid!.listener).is.undefined;
    });
  });

  describe('checkConfig filter evaluation', () => {
    const module = new Skin({
      configs: []
    }, dom.window);

    const jpBidResponse = (format: prebidjs.JustPremiumFormat): prebidjs.IJustPremiumBidResponse => {
      return {
        bidder: prebidjs.JustPremium,
        format: format,
        adId: '',
        cpm: 10.00,
        height: 1,
        width: 1,
        mediaType: 'banner',
        source: 'client'
      };
    };

    describe('just premium wallpaper', () => {

      const config: ISkinConfig = {
        formatFilter: [
          { bidder: 'justpremium', format: 'wp' }
        ],
        skinAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: [ 'sky-slot' ],
        hideSkinAdSlot: false,
        hideBlockedSlots: false
      };

      it('should return true if a just premium wallpaper was found', () => {
        const hasWallpaper = module.checkConfig(config, {
          'wp-slot': {
            bids: [ jpBidResponse('wp') ]
          }
        });

        expect(hasWallpaper).to.be.true;
      });

      it('should return false if a just premium wallpaper was found but cpm 0', () => {
        const hasWallpaper = module.checkConfig(config, {
          'wp-slot': {
            bids: [ { ...jpBidResponse('wp'), cpm: 0 } ]
          }
        });

        expect(hasWallpaper).to.be.false;
      });

      it('should return false if the just premium format does not match was found', () => {
        const hasWallpaper = module.checkConfig(config, {
          'wp-slot': {
            bids: [
              jpBidResponse('pu'),
              jpBidResponse('pd'),
              jpBidResponse('fa'),
              jpBidResponse('cf'),
              jpBidResponse('sa'),
              jpBidResponse('is'),
              jpBidResponse('mt'),
              jpBidResponse('ca'),
            ]
          }
        });
        expect(hasWallpaper).to.be.false;
      });
    });

    describe('just premium cascade ad', () => {

      const config: ISkinConfig = {
        formatFilter: [
          { bidder: 'justpremium', format: 'ca' }
        ],
        skinAdSlotDomId: 'cascade-ad-slot',
        blockedAdSlotDomIds: [ 'sky-slot' ],
        hideSkinAdSlot: false,
        hideBlockedSlots: false
      };

      it('should return true if a just premium mobile skin was found', () => {
        const hasWallpaper = module.checkConfig(config, {
          'cascade-ad-slot': {
            bids: [ jpBidResponse('ca') ]
          }
        });

        expect(hasWallpaper).to.be.true;
      });

      it('should return false if a just premium mobile skin was found but cpm 0', () => {
        const hasWallpaper = module.checkConfig(config, {
          'cascade-ad-slot': {
            bids: [ { ...jpBidResponse('ca'), cpm: 0 } ]
          }
        });

        expect(hasWallpaper).to.be.false;
      });

      it('should return false if the just premium format does not match was found', () => {
        const hasWallpaper = module.checkConfig(config, {
          'cascade-ad-slot': {
            bids: [
              jpBidResponse('pu'),
              jpBidResponse('pd'),
              jpBidResponse('fa'),
              jpBidResponse('cf'),
              jpBidResponse('sa'),
              jpBidResponse('is'),
              jpBidResponse('mt'),
            ]
          }
        });
        expect(hasWallpaper).to.be.false;
      });
    });

    describe('just premium mobile skin', () => {

      const config: ISkinConfig = {
        formatFilter: [
          { bidder: 'justpremium', format: 'mt' }
        ],
        skinAdSlotDomId: 'mobile-skin-slot',
        blockedAdSlotDomIds: [ 'sky-slot' ],
        hideSkinAdSlot: false,
        hideBlockedSlots: false
      };

      it('should return true if a just premium mobile skin was found', () => {
        const hasWallpaper = module.checkConfig(config, {
          'mobile-skin-slot': {
            bids: [ jpBidResponse('mt') ]
          }
        });

        expect(hasWallpaper).to.be.true;
      });

      it('should return false if a just premium mobile skin was found but cpm 0', () => {
        const hasWallpaper = module.checkConfig(config, {
          'mobile-skin-slot': {
            bids: [ { ...jpBidResponse('mt'), cpm: 0 } ]
          }
        });

        expect(hasWallpaper).to.be.false;
      });

      it('should return false if the just premium format does not match was found', () => {
        const hasWallpaper = module.checkConfig(config, {
          'mobile-skin-slot': {
            bids: [
              jpBidResponse('pu'),
              jpBidResponse('pd'),
              jpBidResponse('fa'),
              jpBidResponse('cf'),
              jpBidResponse('sa'),
              jpBidResponse('is'),
              jpBidResponse('ca'),
            ]
          }
        });
        expect(hasWallpaper).to.be.false;
      });
    });

    describe('dspx', () => {

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

      const config: ISkinConfig = {
        formatFilter: [
          { bidder: 'dspx' }
        ],
        skinAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: [ 'sky-slot' ],
        hideSkinAdSlot: false,
        hideBlockedSlots: false
      };

      it('should return true if a dspx response was found', () => {
        const hasWallpaper = module.checkConfig(config, {
          'wp-slot': {
            bids: [ dpsxBidResponse(10.00) ]
          }
        });

        expect(hasWallpaper).to.be.true;
      });

      it('should return false if a dspx response was found but with cpm 0', () => {
        const hasWallpaper = module.checkConfig(config, {
          'wp-slot': {
            bids: [ dpsxBidResponse(0) ]
          }
        });

        expect(hasWallpaper).to.be.false;
      });
    });

    describe('selectConfig filter selection', () => {

      const wallpaperConfig: ISkinConfig = {
        formatFilter: [
          { bidder: 'justpremium', format: 'wp' }
        ],
        skinAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: [ 'sky-slot' ],
        hideSkinAdSlot: false,
        hideBlockedSlots: false
      };

      const mobileSkinConfig: ISkinConfig = {
        formatFilter: [
          { bidder: 'justpremium', format: 'mt' }
        ],
        skinAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: [ 'sky-slot' ],
        hideSkinAdSlot: false,
        hideBlockedSlots: false
      };

      it('should select the first rule that applies', () => {
        const configuredModule = new Skin({
          configs: [ wallpaperConfig, mobileSkinConfig ]
        }, dom.window);

        // select desktop wallpaper
        const wpConfig = configuredModule.selectConfig({ 'wp-slot': { bids: [ jpBidResponse('wp') ] } });
        expect(wpConfig).to.be.equal(wallpaperConfig);

        // select mobile skin
        const mobileConfig = configuredModule.selectConfig({ 'wp-slot': { bids: [ jpBidResponse('mt') ] } });
        expect(mobileConfig).to.be.equal(mobileSkinConfig);

        // select wallpaper config skin
        const wp2Config = configuredModule.selectConfig({ 'wp-slot': { bids: [ jpBidResponse('wp'), jpBidResponse('mt') ] } });
        expect(wp2Config).to.be.equal(wallpaperConfig);
      });

    });

  });

});

// tslint:enable
