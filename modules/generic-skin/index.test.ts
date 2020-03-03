import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import Skin from './index';
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
        wallpaperAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: [ 'sky-slot' ],
        hideWallpaperAdSlot: false
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
        wallpaperAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: [ 'sky-slot' ],
        hideWallpaperAdSlot: false
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

  describe('check for wallpaper', () => {
    const module = new Skin({
      wallpaperAdSlotDomId: 'wp-slot',
      blockedAdSlotDomIds: [ 'sky-slot' ],
      hideWallpaperAdSlot: false
    }, dom.window);

    describe('just premium', () => {
      const jpBidResponse = (format: prebidjs.JustPremiumFormat): prebidjs.IJustPremiumBidResponse => {
        return {
          bidder: prebidjs.JustPremium,
          format: format,
          adId: '',
          cpm: 10.00,
          height: 1,
          width: 1
        };
      };

      it('should return true if a just premium wallpaper was found', () => {
        const hasWallpaper = module.checkForWallpaper({
          'wp-slot': {
            bids: [ jpBidResponse('wp') ]
          }
        });

        expect(hasWallpaper).to.be.true;
      });

      it('should return false if a just premium wallpaper was found but cpm 0', () => {
        const hasWallpaper = module.checkForWallpaper({
          'wp-slot': {
            bids: [ { ...jpBidResponse('wp'), cpm: 0 } ]
          }
        });

        expect(hasWallpaper).to.be.false;
      });

      it('should return false if the just premium format does not match was found', () => {
        const hasWallpaper = module.checkForWallpaper({
          'wp-slot': {
            bids: [
              jpBidResponse('pu'),
              jpBidResponse('pd'),
              jpBidResponse('fa'),
              jpBidResponse('cf'),
              jpBidResponse('sa'),
              jpBidResponse('is')
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
          width: 1
        };
      };

      it('should return true if a dspx response was found', () => {
        const hasWallpaper = module.checkForWallpaper({
          'wp-slot': {
            bids: [ dpsxBidResponse(10.00) ]
          }
        });

        expect(hasWallpaper).to.be.true;
      });

      it('should return false if a dspx response was found but with cpm 0', () => {
        const hasWallpaper = module.checkForWallpaper({
          'wp-slot': {
            bids: [ dpsxBidResponse(0) ]
          }
        });

        expect(hasWallpaper).to.be.false;
      });
    });

  });

});

// tslint:enable
