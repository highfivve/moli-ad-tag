import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { googletag } from 'ad-tag/types/googletag';
import { createGoogletagStub, googleAdSlotStub } from 'ad-tag/stubs/googletagStubs';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { createInterstitialContext } from 'ad-tag/ads/auctions/interstitialContext';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { auction } from 'ad-tag/types/moliConfig';
import { noopLogger } from 'ad-tag/stubs/moliStubs';
import { formatKey } from 'ad-tag/ads/keyValues';

use(sinonChai);

describe('InterstitialContext', () => {
  const sandbox = Sinon.createSandbox();

  const slotDomId = 'interstitial-slot';
  const adUnitPath = '/12345678/example_interstitial';
  const slot: googletag.IAdSlot = googleAdSlotStub(adUnitPath, slotDomId);

  // globals
  const { jsDomWindow } = createDomAndWindow();
  jsDomWindow.googletag = createGoogletagStub();

  // stubs
  const jsDateNowStub = sandbox.stub<[], number>().returns(0);

  const markSlotAsGamInterstitial = (interstitialSlot: googletag.IAdSlot = slot) => {
    interstitialSlot.setTargeting(formatKey, '5');
  };

  const slotRenderEnded = (
    isEmpty: boolean = false,
    slotOverride?: googletag.IAdSlot
  ): googletag.events.ISlotRenderEndedEvent =>
    ({
      slot: slotOverride ?? slot,
      isEmpty
    }) as googletag.events.ISlotRenderEndedEvent;

  const impressionViewableEvent: googletag.events.IImpressionViewableEvent = {
    slot
  } as googletag.events.IImpressionViewableEvent;

  const bidResponse: prebidjs.BidResponse = {
    adUnitCode: slotDomId,
    cpm: 3
  } as prebidjs.BidResponse;

  const auctionEnd = (
    bidsReceived: prebidjs.BidResponse[],
    adUnitCodes: string[] = [slotDomId]
  ): prebidjs.event.AuctionObject =>
    ({
      bidsReceived: bidsReceived,
      adUnitCodes: adUnitCodes
    }) as prebidjs.event.AuctionObject;

  const interstitialContext = (priority: auction.InterstitialChannel[], ttl?: number) => {
    const config: auction.InterstitialConfig = {
      enabled: true,
      adUnitPath,
      domId: slotDomId,
      priority,
      ...(ttl ? { ttlStorage: ttl } : {})
    };
    return createInterstitialContext(config, jsDomWindow, jsDateNowStub, noopLogger);
  };

  afterEach(() => {
    sandbox.reset();
    jsDomWindow.sessionStorage.clear();
    slot.clearTargeting();
  });

  describe('gam only setup', () => {
    it('should allow gam in initial state', () => {
      const interstitial = interstitialContext(['gam']);
      expect(interstitial.interstitialChannel()).to.be.eq('gam');
    });

    it('should allow gam after requestAds has been called', () => {
      const interstitial = interstitialContext(['gam']);
      expect(interstitial.interstitialChannel()).to.be.eq('gam');
    });

    it('should allow gam after an ad has been displayed and next requestAds cycle has started', () => {
      const interstitial = interstitialContext(['gam']);
      markSlotAsGamInterstitial();
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      interstitial.onImpressionViewable(impressionViewableEvent);
      expect(interstitial.interstitialChannel()).to.be.eq('gam');
    });

    describe('ignore none interstitial slots', () => {
      it('should not change interstitial channel if slot is not an interstitial', () => {
        const interstitial = interstitialContext(['gam']);
        const otherSlot = googleAdSlotStub('/12345678/other_slot', 'other-slot');
        interstitial.onSlotRenderEnded({ ...slotRenderEnded(false), slot: otherSlot });
        expect(interstitial.interstitialChannel()).to.be.eq('gam');
      });
    });
  });

  describe('custom only setup (header bidding and IO)', () => {
    it('should allow prebid in initial state', () => {
      const interstitial = interstitialContext(['c']);
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });

    it('should allow prebid after requestAds has been called', () => {
      const interstitial = interstitialContext(['c']);
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });

    it('should allow prebid after an ad has been displayed and next requestAds cycle has started', () => {
      const interstitial = interstitialContext(['c']);
      interstitial.onAuctionEnd(auctionEnd([bidResponse]));
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });
  });

  describe('custom > gam waterfall setup', () => {
    it('should allow prebid in initial state', () => {
      const interstitial = interstitialContext(['c', 'gam']);
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });

    it('should allow prebid after requestAds has been called', () => {
      const interstitial = interstitialContext(['c', 'gam']);
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });

    it('should keep prebid as first priority after an ad has been rendered', () => {
      const interstitial = interstitialContext(['c', 'gam']);
      interstitial.onAuctionEnd(auctionEnd([bidResponse]));
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });

    it('should shift priority to gam if prebid has no demand', () => {
      const interstitial = interstitialContext(['c', 'gam']);
      interstitial.onAuctionEnd(auctionEnd([]));
      expect(interstitial.interstitialChannel()).to.be.eq('gam');
    });

    it('should shift back to prebid again if prebid and gam have no demand', () => {
      const interstitial = interstitialContext(['c', 'gam']);
      interstitial.onAuctionEnd(auctionEnd([]));
      markSlotAsGamInterstitial(); // performed by the checkAndSwitch method in googleAdManager.ts
      interstitial.onSlotRenderEnded(slotRenderEnded(true));
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });

    it('should allow prebid again after requestAds if prebid had no demand, but gam delivered', () => {
      const interstitial = interstitialContext(['c', 'gam']);
      interstitial.onAuctionEnd(auctionEnd([]));
      markSlotAsGamInterstitial(); // performed by the checkAndSwitch method in googleAdManager.ts
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      interstitial.onImpressionViewable(impressionViewableEvent);
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });
  });

  describe('gam > custom waterfall setup', () => {
    it('should allow gam in initial state', () => {
      const interstitial = interstitialContext(['gam', 'c']);
      expect(interstitial.interstitialChannel()).to.be.eq('gam');
    });

    it('should allow gam after requestAds has been called', () => {
      const interstitial = interstitialContext(['gam', 'c']);
      expect(interstitial.interstitialChannel()).to.be.eq('gam');
    });

    it('should keep gam in first priority after an ad has been rendered, but not visible', () => {
      const interstitial = interstitialContext(['gam', 'c']);
      markSlotAsGamInterstitial();
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      expect(interstitial.interstitialChannel()).to.be.eq('gam');
    });

    it('should allow prebid if gam has no demand', () => {
      const interstitial = interstitialContext(['gam', 'c']);
      markSlotAsGamInterstitial();
      interstitial.onSlotRenderEnded(slotRenderEnded(true));
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });

    it('should shift priority to prebid after an ad has been displayed and next requestAds cycle has started', () => {
      const interstitial = interstitialContext(['gam', 'c']);
      markSlotAsGamInterstitial();
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      interstitial.onImpressionViewable(impressionViewableEvent);
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });
  });

  describe('persistence and ttl configuration', () => {
    it('should load initial state from localStorage', () => {
      jsDateNowStub.returns(2000);
      jsDomWindow.sessionStorage.setItem(
        'h5v_intstl',
        JSON.stringify({ priority: ['gam', 'c'], updatedAt: 1000 })
      );
      const interstitial = interstitialContext(['gam']);
      expect(interstitial.interstitialState().updatedAt).to.be.eq(1000);
      expect(interstitial.interstitialState().priority).to.be.deep.eq(['gam', 'c']);
    });

    it('should not load state from localStorage if ttl is exceeded', () => {
      jsDateNowStub.returns(2000);
      jsDomWindow.sessionStorage.setItem(
        'h5v_intstl',
        JSON.stringify({ priority: ['gam', 'c'], updatedAt: 1000 })
      );
      const interstitial = interstitialContext(['c', 'gam'], 500);
      expect(interstitial.interstitialState().updatedAt).to.be.eq(2000);
      expect(interstitial.interstitialState().priority).to.be.deep.eq(['c', 'gam']);
    });
  });

  describe('ad unit path variables', () => {
    const dynamicAdUnitPath = '/123/interstitial/{device}';
    const resolvedAdUnitPath = '/123/interstitial/mobile';
    const slot: googletag.IAdSlot = googleAdSlotStub(resolvedAdUnitPath, slotDomId);
    const interstitialContextDynamicPath = (priority: auction.InterstitialChannel[]) => {
      const config: auction.InterstitialConfig = {
        enabled: true,
        adUnitPath: dynamicAdUnitPath,
        domId: slotDomId,
        priority
      };
      return createInterstitialContext(config, jsDomWindow, jsDateNowStub, noopLogger);
    };

    beforeEach(() => {
      slot.clearTargeting();
    });

    it('should use resolved ad unit path in onSlotRenderEnded to skip events', () => {
      const interstitial = interstitialContextDynamicPath(['c', 'gam']);
      expect(interstitial.interstitialChannel()).to.be.eq('c');
      interstitial.onSlotRenderEnded(slotRenderEnded(true, slot));
      expect(interstitial.interstitialChannel()).to.be.eq('c');
      // only one initialization call
      expect(jsDateNowStub).to.have.been.calledOnce;

      // after resolving the ad unit path, demand shifting works
      interstitial.updateAdUnitPaths({ device: 'mobile' });
      interstitial.onSlotRenderEnded(slotRenderEnded(true, slot));
      expect(interstitial.interstitialChannel()).to.be.eq('gam');
      expect(jsDateNowStub).to.have.been.calledTwice; // initialization and update
    });

    it('should use resolved ad unit path in onImpressionViewable to skip events', () => {
      const interstitial = interstitialContextDynamicPath(['gam', 'c']);
      expect(interstitial.interstitialChannel()).to.be.eq('gam');
      markSlotAsGamInterstitial(slot);
      interstitial.onImpressionViewable({ ...impressionViewableEvent, slot });
      expect(interstitial.interstitialChannel()).to.be.eq('gam');
      // only one initialization call
      expect(jsDateNowStub).to.have.been.calledOnce;

      // after resolving the ad unit path, demand shifting works
      interstitial.updateAdUnitPaths({ device: 'mobile' });
      interstitial.onImpressionViewable({ ...impressionViewableEvent, slot });
      expect(interstitial.interstitialChannel()).to.be.eq('c');
      expect(jsDateNowStub).to.have.been.calledTwice; // initialization and update
    });

    it('should use the domId and adUnitCodes in onAuctionEnd to skip events', () => {
      const interstitial = interstitialContextDynamicPath(['c', 'gam']);
      expect(interstitial.interstitialChannel()).to.be.eq('c');
      interstitial.onAuctionEnd(auctionEnd([bidResponse], ['another-slot']));
      expect(interstitial.interstitialChannel()).to.be.eq('c');
      // only one initialization call
      expect(jsDateNowStub).to.have.been.calledOnce;
    });
  });
});
