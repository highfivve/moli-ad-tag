import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { googletag } from 'ad-tag/types/googletag';
import { createGoogletagStub, googleAdSlotStub } from 'ad-tag/stubs/googletagStubs';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { createAnchorContext } from 'ad-tag/ads/auctions/anchorContext';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { auction } from 'ad-tag/types/moliConfig';
import { noopLogger } from 'ad-tag/stubs/moliStubs';

use(sinonChai);

describe('anchorContext', () => {
  const sandbox = Sinon.createSandbox();

  const mobileDomId = 'mobile_stickyad';
  const mobileAdUnitPath = '/12345678/mobile_stickyad';
  const desktopDomId = 'floorad';
  const desktopAdUnitPath = '/12345678/floorad';
  const topDomId = 'header';
  const topAdUnitPath = '/12345678/header';

  const { jsDomWindow } = createDomAndWindow();
  jsDomWindow.googletag = createGoogletagStub();

  const jsDateNowStub = sandbox.stub<[], number>().returns(0);

  const anchorConfig = (
    domId: string,
    adUnitPath: string,
    priority: auction.AnchorChannel[]
  ): auction.AnchorConfig => ({
    enabled: true,
    adUnitPath,
    domId,
    priority
  });

  const slotRenderEnded = (
    slot: googletag.IAdSlot,
    isEmpty: boolean = false
  ): googletag.events.ISlotRenderEndedEvent =>
    ({
      slot,
      isEmpty
    }) as googletag.events.ISlotRenderEndedEvent;

  const auctionEnd = (
    adUnitCodes: string[],
    bidsReceived: prebidjs.BidResponse[] = []
  ): prebidjs.event.AuctionObject =>
    ({
      bidsReceived,
      adUnitCodes
    }) as prebidjs.event.AuctionObject;

  afterEach(() => {
    sandbox.reset();
    jsDomWindow.sessionStorage.clear();
  });

  it('should return undefined for a domId that is not configured for the bottom anchor', () => {
    const context = createAnchorContext(
      {
        bottomMobile: anchorConfig(mobileDomId, mobileAdUnitPath, ['c', 'gam'])
      },
      jsDomWindow,
      jsDateNowStub,
      noopLogger
    );
    expect(context.anchorBottomChannel('some-other-dom-id')).to.be.undefined;
  });

  it('should disambiguate the bottom anchor instance via domId', () => {
    const context = createAnchorContext(
      {
        bottomMobile: anchorConfig(mobileDomId, mobileAdUnitPath, ['c', 'gam']),
        bottomDesktop: anchorConfig(desktopDomId, desktopAdUnitPath, ['gam', 'c'])
      },
      jsDomWindow,
      jsDateNowStub,
      noopLogger
    );
    expect(context.anchorBottomChannel(mobileDomId)).to.be.eq('c');
    expect(context.anchorBottomChannel(desktopDomId)).to.be.eq('gam');
  });

  it('should keep top anchor state independent from the bottom instances', () => {
    const context = createAnchorContext(
      {
        bottomMobile: anchorConfig(mobileDomId, mobileAdUnitPath, ['c', 'gam']),
        top: anchorConfig(topDomId, topAdUnitPath, ['gam', 'c'])
      },
      jsDomWindow,
      jsDateNowStub,
      noopLogger
    );
    expect(context.anchorTopChannel()).to.be.eq('gam');

    context.onSlotRenderEnded(slotRenderEnded(googleAdSlotStub(topAdUnitPath, topDomId), true));
    expect(context.anchorTopChannel()).to.be.eq('c');
    expect(context.anchorBottomChannel(mobileDomId)).to.be.eq('c');
  });

  it('should route onAuctionEnd to the matching bottom instance only', () => {
    const context = createAnchorContext(
      {
        bottomMobile: anchorConfig(mobileDomId, mobileAdUnitPath, ['c', 'gam']),
        bottomDesktop: anchorConfig(desktopDomId, desktopAdUnitPath, ['c', 'gam'])
      },
      jsDomWindow,
      jsDateNowStub,
      noopLogger
    );
    context.onAuctionEnd(auctionEnd([mobileDomId], []));
    expect(context.anchorBottomChannel(mobileDomId)).to.be.eq('gam');
    expect(context.anchorBottomChannel(desktopDomId)).to.be.eq('c');
  });

  it('should not wire an instance that has no config', () => {
    const context = createAnchorContext({}, jsDomWindow, jsDateNowStub, noopLogger);
    expect(context.anchorBottomChannel(mobileDomId)).to.be.undefined;
    expect(context.anchorTopChannel()).to.be.undefined;
    // should not throw when routing events with nothing configured
    context.onAuctionEnd(auctionEnd([mobileDomId]));
    context.onSlotRenderEnded(slotRenderEnded(googleAdSlotStub(topAdUnitPath, topDomId)));
    context.updateAdUnitPaths({});
  });

  it('should resolve ad unit path variables for all configured instances', () => {
    const dynamicAdUnitPath = '/123/mobile_stickyad/{device}';
    const resolvedAdUnitPath = '/123/mobile_stickyad/mobile';
    const context = createAnchorContext(
      {
        bottomMobile: anchorConfig(mobileDomId, dynamicAdUnitPath, ['gam', 'c'])
      },
      jsDomWindow,
      jsDateNowStub,
      noopLogger
    );
    context.updateAdUnitPaths({ device: 'mobile' });
    context.onSlotRenderEnded(
      slotRenderEnded(googleAdSlotStub(resolvedAdUnitPath, mobileDomId), true)
    );
    expect(context.anchorBottomChannel(mobileDomId)).to.be.eq('c');
  });
});
