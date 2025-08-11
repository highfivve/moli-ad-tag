import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { googletag } from 'ad-tag/types/googletag';
import { googleAdSlotStub } from 'ad-tag/stubs/googletagStubs';
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

  // mock the static values for googletag enums
  jsDomWindow.googletag = {
    enums: {
      OutOfPageFormat: {
        INTERSTITIAL: 5 // OutOfPageFormat.INTERSTITIAL.toString()
      }
    }
  } as any;

  // stubs
  const slotGetTargetingStub = sandbox.stub(slot, 'getTargeting');
  const jsDateNowStub = sandbox.stub<[], number>().returns(0);

  const markSlotAsGamInterstitial = () => {
    slotGetTargetingStub.callsFake(key => {
      if (key === formatKey) {
        return ['5']; // OutOfPageFormat.INTERSTITIAL.toString()
      }
      return [];
    });
  };

  const slotRequested: googletag.events.ISlotRequestedEvent = {
    slot
  } as googletag.events.ISlotRequestedEvent;

  const slotRenderEnded = (isEmpty: boolean = false): googletag.events.ISlotRenderEndedEvent =>
    ({
      slot,
      isEmpty
    }) as googletag.events.ISlotRenderEndedEvent;

  const impressionViewableEvent: googletag.events.IImpressionViewableEvent = {
    slot
  } as googletag.events.IImpressionViewableEvent;

  const bidResponse: prebidjs.BidResponse = {
    adUnitCode: slotDomId,
    cpm: 3
  } as prebidjs.BidResponse;

  const auctionEnd = (bidsReceived: prebidjs.BidResponse[]): prebidjs.event.AuctionObject =>
    ({
      bidsReceived: bidsReceived,
      adUnitCodes: [slotDomId]
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

  beforeEach(() => {
    slotGetTargetingStub.callThrough();
  });

  afterEach(() => {
    sandbox.reset();
    jsDomWindow.sessionStorage.clear();
  });

  describe('gam only setup', () => {
    it('should allow gam in initial state', () => {
      const interstitial = interstitialContext(['gam']);
      expect(interstitial.interstitialChannel()).to.be.eq('gam');
    });

    it('should allow gam after requestAds has been called', () => {
      const interstitial = interstitialContext(['gam']);
      interstitial.beforeRequestAds();
      expect(interstitial.interstitialChannel()).to.be.eq('gam');
    });

    // FIXME this will be fixed, once we put the channel priority into the state logic
    it.skip('should allow gam in initial state with no priority', () => {
      const interstitial = interstitialContext([]);
      expect(interstitial.interstitialChannel()).to.be.eq('gam');
    });

    it('should not allow gam after an ad has been rendered', () => {
      const interstitial = interstitialContext(['gam']);
      interstitial.beforeRequestAds();
      markSlotAsGamInterstitial();
      interstitial.onSlotRequested(slotRequested);
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      expect(interstitial.interstitialChannel()).to.be.undefined;
    });

    it('should allow gam after an ad has been displayed', () => {
      const interstitial = interstitialContext(['gam']);
      interstitial.beforeRequestAds();
      markSlotAsGamInterstitial();
      interstitial.onSlotRequested(slotRequested);
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      interstitial.onImpressionViewable(impressionViewableEvent);
      expect(interstitial.interstitialChannel()).to.be.undefined;
    });

    it('should allow gam after an ad has been displayed and next requestAds cycle has started', () => {
      const interstitial = interstitialContext(['gam']);
      interstitial.beforeRequestAds();
      markSlotAsGamInterstitial();
      interstitial.onSlotRequested(slotRequested);
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      interstitial.onImpressionViewable(impressionViewableEvent);
      interstitial.beforeRequestAds();
      expect(interstitial.interstitialChannel()).to.be.eq('gam');
    });

    describe('ignore none interstitial slots', () => {
      it('should not change interstitial channel if slot is not an interstitial', () => {
        const interstitial = interstitialContext(['gam']);
        const otherSlot = googleAdSlotStub('/12345678/other_slot', 'other-slot');
        interstitial.beforeRequestAds();
        interstitial.onSlotRequested({ ...slotRequested, slot: otherSlot });
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
      interstitial.beforeRequestAds();
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });

    it('should not prebid gam after an ad has been rendered', () => {
      const interstitial = interstitialContext(['gam']);
      interstitial.beforeRequestAds();
      interstitial.onAuctionEnd(auctionEnd([bidResponse]));
      interstitial.onSlotRequested(slotRequested);
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      expect(interstitial.interstitialChannel()).to.be.undefined;
    });

    it('should allow prebid after an ad has been displayed and next requestAds cycle has started', () => {
      const interstitial = interstitialContext(['c']);
      interstitial.beforeRequestAds();
      interstitial.onAuctionEnd(auctionEnd([bidResponse]));
      interstitial.onSlotRequested(slotRequested);
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      interstitial.beforeRequestAds();
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
      interstitial.beforeRequestAds();
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });

    it('should not allow prebid after an ad has been rendered', () => {
      const interstitial = interstitialContext(['c', 'gam']);
      interstitial.beforeRequestAds();
      interstitial.onAuctionEnd(auctionEnd([bidResponse]));
      interstitial.onSlotRequested(slotRequested);
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      expect(interstitial.interstitialChannel()).to.be.undefined;
    });

    it('should allow prebid after an ad has been displayed and next requestAds cycle has started', () => {
      const interstitial = interstitialContext(['c', 'gam']);
      interstitial.beforeRequestAds();
      interstitial.onAuctionEnd(auctionEnd([bidResponse]));
      interstitial.onSlotRequested(slotRequested);
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      interstitial.beforeRequestAds();
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });

    it('should allow gam if prebid has no demand', () => {
      const interstitial = interstitialContext(['c', 'gam']);
      interstitial.beforeRequestAds();
      interstitial.onAuctionEnd(auctionEnd([]));
      expect(interstitial.interstitialChannel()).to.be.eq('gam');
    });

    it('should allow prebid again if prebid and gam have no demand', () => {
      const interstitial = interstitialContext(['c', 'gam']);
      interstitial.beforeRequestAds();
      interstitial.onAuctionEnd(auctionEnd([]));
      markSlotAsGamInterstitial(); // performed by the checkAndSwitch method in googleAdManager.ts
      interstitial.onSlotRequested(slotRequested);
      interstitial.onSlotRenderEnded(slotRenderEnded(true));
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });

    it('should not allow prebid or gam if prebid had no demand, but gam delivered', () => {
      const interstitial = interstitialContext(['c', 'gam']);
      interstitial.beforeRequestAds();
      interstitial.onAuctionEnd(auctionEnd([]));
      markSlotAsGamInterstitial(); // performed by the checkAndSwitch method in googleAdManager.ts
      interstitial.onSlotRequested(slotRequested);
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      interstitial.onImpressionViewable(impressionViewableEvent);
      expect(interstitial.interstitialChannel()).to.be.undefined;
    });

    it('should allow prebid again after requestAds if prebid had no demand, but gam delivered', () => {
      const interstitial = interstitialContext(['c', 'gam']);
      interstitial.beforeRequestAds();
      interstitial.onAuctionEnd(auctionEnd([]));
      markSlotAsGamInterstitial(); // performed by the checkAndSwitch method in googleAdManager.ts
      interstitial.onSlotRequested(slotRequested);
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      interstitial.onImpressionViewable(impressionViewableEvent);
      interstitial.beforeRequestAds();
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
      interstitial.beforeRequestAds();
      expect(interstitial.interstitialChannel()).to.be.eq('gam');
    });

    it('should not allow gam after an ad has been rendered', () => {
      const interstitial = interstitialContext(['gam', 'c']);
      interstitial.beforeRequestAds();
      markSlotAsGamInterstitial();
      interstitial.onSlotRequested(slotRequested);
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      expect(interstitial.interstitialChannel()).to.be.undefined;
    });

    it('should allow prebid if gam has no demand', () => {
      const interstitial = interstitialContext(['gam', 'c']);
      interstitial.beforeRequestAds();
      markSlotAsGamInterstitial();
      interstitial.onSlotRequested(slotRequested);
      interstitial.onSlotRenderEnded(slotRenderEnded(true));
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });

    it('should allow prebid if gam has no demand after next requestAds cycle has started', () => {
      const interstitial = interstitialContext(['gam', 'c']);
      interstitial.beforeRequestAds();
      markSlotAsGamInterstitial();
      interstitial.onSlotRequested(slotRequested);
      interstitial.onSlotRenderEnded(slotRenderEnded(true));
      interstitial.beforeRequestAds();
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });

    it('should allow prebid after an ad has been displayed and next requestAds cycle has started', () => {
      const interstitial = interstitialContext(['gam', 'c']);
      interstitial.beforeRequestAds();
      markSlotAsGamInterstitial();
      interstitial.onSlotRequested(slotRequested);
      interstitial.onSlotRenderEnded(slotRenderEnded(false));
      interstitial.beforeRequestAds();
      expect(interstitial.interstitialChannel()).to.be.eq('c');
    });
  });

  describe('persistence and ttl configuration', () => {
    it('should load initial state from localStorage', () => {
      jsDateNowStub.returns(2000);
      jsDomWindow.sessionStorage.setItem(
        'h5v_intstl',
        JSON.stringify({
          state: 'rendered',
          channel: 'gam',
          updatedAt: 1000
        })
      );
      const interstitial = interstitialContext(['gam']);
      expect(interstitial.interstitialState().updatedAt).to.be.eq(1000);
      expect(interstitial.interstitialState().state).to.be.eq('rendered');
      expect(interstitial.interstitialState().channel).to.be.eq('gam');
    });

    it('should not load state from localStorage if ttl is exceeded', () => {
      jsDateNowStub.returns(2000);
      jsDomWindow.sessionStorage.setItem(
        'h5v_intstl',
        JSON.stringify({
          state: 'rendered',
          channel: 'gam',
          updatedAt: 1000
        })
      );
      const interstitial = interstitialContext(['gam'], 500);
      expect(interstitial.interstitialState().updatedAt).to.be.eq(2000);
      expect(interstitial.interstitialState().state).to.be.eq('init');
      expect(interstitial.interstitialState().channel).to.be.eq('gam');
    });
  });
});
