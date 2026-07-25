import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { googletag } from 'ad-tag/types/googletag';
import { createGoogletagStub, googleAdSlotStub } from 'ad-tag/stubs/googletagStubs';
import { prebidjs } from 'ad-tag/types/prebidjs';
import {
  createWaterfallContext,
  createFailOnlyRotationTrigger
} from 'ad-tag/ads/auctions/waterfallContext';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { auction } from 'ad-tag/types/moliConfig';
import { noopLogger } from 'ad-tag/stubs/moliStubs';

use(sinonChai);

describe('waterfallContext', () => {
  const sandbox = Sinon.createSandbox();

  const slotDomId = 'anchor-slot';
  const adUnitPath = '/12345678/example_anchor';
  const slot: googletag.IAdSlot = googleAdSlotStub(adUnitPath, slotDomId);
  const sessionStorageKey = 'h5v_test_waterfall';

  const { jsDomWindow } = createDomAndWindow();
  jsDomWindow.googletag = createGoogletagStub();

  const jsDateNowStub = sandbox.stub<[], number>().returns(0);

  const slotRenderEnded = (
    isEmpty: boolean = false,
    slotOverride?: googletag.IAdSlot
  ): googletag.events.ISlotRenderEndedEvent =>
    ({
      slot: slotOverride ?? slot,
      isEmpty
    }) as googletag.events.ISlotRenderEndedEvent;

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

  const waterfallContext = (priority: auction.AnchorChannel[], ttl?: number) => {
    const config: auction.AnchorConfig = {
      enabled: true,
      adUnitPath,
      domId: slotDomId,
      priority,
      ...(ttl ? { ttlStorage: ttl } : {})
    };
    return createWaterfallContext(
      sessionStorageKey,
      config,
      createFailOnlyRotationTrigger<auction.AnchorChannel>(),
      jsDomWindow,
      jsDateNowStub,
      noopLogger,
      'test-waterfall'
    );
  };

  afterEach(() => {
    sandbox.reset();
    jsDomWindow.sessionStorage.clear();
  });

  describe('gam only setup', () => {
    it('should allow gam in initial state', () => {
      const waterfall = waterfallContext(['gam']);
      expect(waterfall.channel()).to.be.eq('gam');
    });

    it('should keep gam after a successful (non-empty) render', () => {
      const waterfall = waterfallContext(['gam']);
      waterfall.onSlotRenderEnded(slotRenderEnded(false));
      expect(waterfall.channel()).to.be.eq('gam');
    });
  });

  describe('custom only setup', () => {
    it('should allow custom in initial state', () => {
      const waterfall = waterfallContext(['c']);
      expect(waterfall.channel()).to.be.eq('c');
    });

    it('should keep custom after bids are received', () => {
      const waterfall = waterfallContext(['c']);
      waterfall.onAuctionEnd(auctionEnd([bidResponse]));
      expect(waterfall.channel()).to.be.eq('c');
    });
  });

  describe('custom > gam waterfall (fail-only rotation)', () => {
    it('should allow custom in initial state', () => {
      const waterfall = waterfallContext(['c', 'gam']);
      expect(waterfall.channel()).to.be.eq('c');
    });

    it('should keep custom as first priority when it keeps delivering bids', () => {
      const waterfall = waterfallContext(['c', 'gam']);
      waterfall.onAuctionEnd(auctionEnd([bidResponse]));
      expect(waterfall.channel()).to.be.eq('c');
    });

    it('should shift priority to gam if custom has no bid', () => {
      const waterfall = waterfallContext(['c', 'gam']);
      waterfall.onAuctionEnd(auctionEnd([]));
      expect(waterfall.channel()).to.be.eq('gam');
    });

    it('should not shift priority on a successful gam render, unlike the interstitial waterfall', () => {
      const waterfall = waterfallContext(['c', 'gam']);
      waterfall.onAuctionEnd(auctionEnd([]));
      expect(waterfall.channel()).to.be.eq('gam');
      waterfall.onSlotRenderEnded(slotRenderEnded(false));
      expect(waterfall.channel()).to.be.eq('gam');
    });

    it('should shift back to custom if gam also returns an empty ad', () => {
      const waterfall = waterfallContext(['c', 'gam']);
      waterfall.onAuctionEnd(auctionEnd([]));
      expect(waterfall.channel()).to.be.eq('gam');
      waterfall.onSlotRenderEnded(slotRenderEnded(true));
      expect(waterfall.channel()).to.be.eq('c');
    });
  });

  describe('gam > custom waterfall (fail-only rotation)', () => {
    it('should allow gam in initial state', () => {
      const waterfall = waterfallContext(['gam', 'c']);
      expect(waterfall.channel()).to.be.eq('gam');
    });

    it('should keep gam as first priority on a successful render', () => {
      const waterfall = waterfallContext(['gam', 'c']);
      waterfall.onSlotRenderEnded(slotRenderEnded(false));
      expect(waterfall.channel()).to.be.eq('gam');
    });

    it('should shift priority to custom if gam returns an empty ad', () => {
      const waterfall = waterfallContext(['gam', 'c']);
      waterfall.onSlotRenderEnded(slotRenderEnded(true));
      expect(waterfall.channel()).to.be.eq('c');
    });
  });

  describe('ignore unrelated events', () => {
    it('should not shift priority for a slotRenderEnded of another ad unit', () => {
      const waterfall = waterfallContext(['gam', 'c']);
      const otherSlot = googleAdSlotStub('/12345678/other_slot', 'other-slot');
      waterfall.onSlotRenderEnded({ ...slotRenderEnded(true), slot: otherSlot });
      expect(waterfall.channel()).to.be.eq('gam');
    });

    it('should not shift priority for an auctionEnd that does not include this domId', () => {
      const waterfall = waterfallContext(['c', 'gam']);
      waterfall.onAuctionEnd(auctionEnd([], ['another-slot']));
      expect(waterfall.channel()).to.be.eq('c');
    });
  });

  describe('persistence and ttl configuration', () => {
    it('should load initial state from session storage', () => {
      jsDateNowStub.returns(2000);
      jsDomWindow.sessionStorage.setItem(
        sessionStorageKey,
        JSON.stringify({ priority: ['gam', 'c'], updatedAt: 1000 })
      );
      const waterfall = waterfallContext(['gam']);
      expect(waterfall.state().updatedAt).to.be.eq(1000);
      expect(waterfall.state().priority).to.be.deep.eq(['gam', 'c']);
    });

    it('should not load state from session storage if ttl is exceeded', () => {
      jsDateNowStub.returns(2000);
      jsDomWindow.sessionStorage.setItem(
        sessionStorageKey,
        JSON.stringify({ priority: ['gam', 'c'], updatedAt: 1000 })
      );
      const waterfall = waterfallContext(['c', 'gam'], 500);
      expect(waterfall.state().updatedAt).to.be.eq(2000);
      expect(waterfall.state().priority).to.be.deep.eq(['c', 'gam']);
    });
  });

  describe('ad unit path variables', () => {
    const dynamicAdUnitPath = '/123/anchor/{device}';
    const resolvedAdUnitPath = '/123/anchor/mobile';
    const dynamicSlot: googletag.IAdSlot = googleAdSlotStub(resolvedAdUnitPath, slotDomId);

    const waterfallContextDynamicPath = (priority: auction.AnchorChannel[]) => {
      const config: auction.AnchorConfig = {
        enabled: true,
        adUnitPath: dynamicAdUnitPath,
        domId: slotDomId,
        priority
      };
      return createWaterfallContext(
        sessionStorageKey,
        config,
        createFailOnlyRotationTrigger<auction.AnchorChannel>(),
        jsDomWindow,
        jsDateNowStub,
        noopLogger,
        'test-waterfall'
      );
    };

    it('should not match events until the ad unit path has been resolved', () => {
      const waterfall = waterfallContextDynamicPath(['gam', 'c']);
      expect(waterfall.channel()).to.be.eq('gam');
      waterfall.onSlotRenderEnded(slotRenderEnded(true, dynamicSlot));
      expect(waterfall.channel()).to.be.eq('gam');

      waterfall.updateAdUnitPaths({ device: 'mobile' });
      waterfall.onSlotRenderEnded(slotRenderEnded(true, dynamicSlot));
      expect(waterfall.channel()).to.be.eq('c');
    });
  });
});
