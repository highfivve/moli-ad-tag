import { expect, use } from 'chai';
import { FrequencyCapping } from './frequencyCapping';
import { prebidjs } from '../../types/prebidjs';
import { createDom } from '../../stubs/browserEnvSetup';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import BidResponse = prebidjs.BidResponse;
import { auction } from 'ad-tag/types/moliConfig';
use(sinonChai);

describe('FrequencyCapping', () => {
  const dom = createDom();
  const jsDomWindow: Window = dom.window as any;

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();
  const setTimeoutSpy = sandbox.spy(jsDomWindow, 'setTimeout');

  const wpDomId = 'wp-slot';
  const dspxWpConfig: auction.BidderFrequencyConfig = {
    bidder: prebidjs.DSPX,
    domId: wpDomId,
    blockedForMs: 10000
  };

  const interstitialDomId = 'interstitial';
  const visxInterstitialConfig: auction.BidderFrequencyConfig = {
    bidder: prebidjs.Visx,
    domId: interstitialDomId,
    blockedForMs: 10000,
    events: ['bidWon', 'bidRequested']
  };

  const dspxBidResponse: BidResponse = {
    bidder: prebidjs.DSPX,
    adUnitCode: dspxWpConfig.domId
  } as BidResponse;

  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });

  beforeEach(() => {
    sandbox.useFakeTimers();
  });

  afterEach(() => {
    sandbox.reset();
    sandbox.clock.restore();
  });

  it('should not add a frequency cap if configs are empty', () => {
    const frequencyCapping = new FrequencyCapping({ enabled: true, configs: [] }, jsDomWindow);
    expect(frequencyCapping.isFrequencyCapped('wp-slot', prebidjs.DSPX)).to.be.false;
  });

  it('should not add a frequency cap if no events have been fired', () => {
    const frequencyCapping = new FrequencyCapping(
      { enabled: true, configs: [dspxWpConfig] },
      jsDomWindow
    );
    expect(frequencyCapping.isFrequencyCapped(dspxWpConfig.domId, prebidjs.DSPX)).to.be.false;
  });

  describe('onBidWon', () => {
    let frequencyCapping: FrequencyCapping;
    beforeEach(() => {
      frequencyCapping = new FrequencyCapping(
        { enabled: true, configs: [dspxWpConfig] },
        jsDomWindow
      );
    });

    it('should not add a frequency cap if the configured bidder did not win the auction on the slot', () => {
      const bid: BidResponse = {
        bidder: prebidjs.GumGum,
        adUnitCode: wpDomId
      } as BidResponse;

      frequencyCapping.onBidWon(bid);

      expect(frequencyCapping.isFrequencyCapped(wpDomId, prebidjs.DSPX)).to.be.false;
    });

    it('should add a frequency cap when a bid is won on the configured slot', () => {
      frequencyCapping.onBidWon(dspxBidResponse);
      expect(frequencyCapping.isFrequencyCapped(wpDomId, prebidjs.DSPX)).to.be.true;
    });

    it('should remove the frequency cap after the specified timeout', () => {
      frequencyCapping.onBidWon(dspxBidResponse);
      expect(frequencyCapping.isFrequencyCapped(wpDomId, prebidjs.DSPX)).to.be.true;

      sandbox.clock.tick(11000);
      expect(setTimeoutSpy).to.have.been.calledOnceWithExactly(Sinon.match.func, 10000);
      expect(frequencyCapping.isFrequencyCapped(wpDomId, prebidjs.DSPX)).to.be.false;
    });
  });

  describe('onAuctionEnd', () => {
    const auction = (
      bidderRequestsBids: Array<{
        bidder: prebidjs.BidderCode;
        adUnitCode: string;
      }>
    ): prebidjs.event.AuctionObject =>
      ({ bidderRequests: [{ bids: bidderRequestsBids }] }) as prebidjs.event.AuctionObject;

    let frequencyCapping: FrequencyCapping;
    beforeEach(() => {
      frequencyCapping = new FrequencyCapping(
        { enabled: true, configs: [dspxWpConfig, visxInterstitialConfig] },
        jsDomWindow
      );
    });

    it('should not add a frequency cap if no events have been fired', () => {
      expect(frequencyCapping.isFrequencyCapped(interstitialDomId, prebidjs.Visx)).to.be.false;
    });

    it('should not add a frequency cap if the configured bidder did not request a bid on the slot', () => {
      frequencyCapping.onAuctionEnd(auction([]));

      expect(frequencyCapping.isFrequencyCapped(interstitialDomId, prebidjs.Visx)).to.be.false;
    });

    it('should add a frequency cap when a bid is requested on the configured slot', () => {
      frequencyCapping.onAuctionEnd(
        auction([{ bidder: prebidjs.Visx, adUnitCode: interstitialDomId }])
      );

      expect(frequencyCapping.isFrequencyCapped(interstitialDomId, prebidjs.Visx)).to.be.true;
    });

    it('should remove the frequency cap after the specified timeout', () => {
      frequencyCapping.onAuctionEnd(
        auction([{ bidder: prebidjs.Visx, adUnitCode: interstitialDomId }])
      );
      expect(frequencyCapping.isFrequencyCapped(interstitialDomId, prebidjs.Visx)).to.be.true;

      sandbox.clock.tick(11000);
      expect(setTimeoutSpy).to.have.been.calledOnceWithExactly(Sinon.match.func, 10000);
      expect(frequencyCapping.isFrequencyCapped(interstitialDomId, prebidjs.Visx)).to.be.false;
    });
  });
});
