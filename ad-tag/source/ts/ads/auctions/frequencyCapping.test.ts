import { expect, use } from 'chai';
import { FrequencyCapping } from './frequencyCapping';
import { prebidjs } from '../../types/prebidjs';
import { createDomAndWindow } from '../../stubs/browserEnvSetup';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import BidResponse = prebidjs.BidResponse;
import { auction } from 'ad-tag/types/moliConfig';
import { newNoopLogger, noopLogger } from 'ad-tag/stubs/moliStubs';
use(sinonChai);

describe('FrequencyCapping', () => {
  const { jsDomWindow } = createDomAndWindow();

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();
  const setTimeoutSpy = sandbox.spy(jsDomWindow, 'setTimeout');
  const nowInstantStub = sandbox.stub<any, number>().returns(100000);

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
    adUnitCode: dspxWpConfig.domId,
    cpm: 20,
    ttl: 60000,
    ad: 'test ad'
  } as BidResponse;

  const auction = (
    bidderRequestsBids: Array<{
      bidder: prebidjs.BidderCode;
      adUnitCode: string;
    }>
  ): prebidjs.event.AuctionObject =>
    ({ bidderRequests: [{ bids: bidderRequestsBids }] }) as prebidjs.event.AuctionObject;

  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });

  beforeEach(() => {
    sandbox.useFakeTimers();
    jsDomWindow.sessionStorage.clear();
  });

  afterEach(() => {
    sandbox.reset();
    sandbox.clock.restore();
  });

  it('should not add a frequency cap if configs are empty', () => {
    const frequencyCapping = new FrequencyCapping(
      { enabled: true, configs: [] },
      jsDomWindow,
      nowInstantStub,
      noopLogger
    );
    expect(frequencyCapping.isFrequencyCapped('wp-slot', prebidjs.DSPX)).to.be.false;
    expect(jsDomWindow.sessionStorage.getItem('h5v-fc')).to.be.null;
  });

  it('should not add a frequency cap if no events have been fired', () => {
    const frequencyCapping = new FrequencyCapping(
      { enabled: true, configs: [dspxWpConfig] },
      jsDomWindow,
      nowInstantStub,
      noopLogger
    );
    expect(frequencyCapping.isFrequencyCapped(dspxWpConfig.domId, prebidjs.DSPX)).to.be.false;
    expect(jsDomWindow.sessionStorage.getItem('h5v-fc'));
  });

  describe('onBidWon', () => {
    let frequencyCapping: FrequencyCapping;
    beforeEach(() => {
      frequencyCapping = new FrequencyCapping(
        { enabled: true, configs: [dspxWpConfig] },
        jsDomWindow,
        nowInstantStub,
        noopLogger
      );
    });

    it('should not add a frequency cap if the configured bidder did not win the auction on the slot', () => {
      const bid: BidResponse = { bidder: prebidjs.GumGum, adUnitCode: wpDomId } as BidResponse;

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
    let frequencyCapping: FrequencyCapping;
    beforeEach(() => {
      frequencyCapping = new FrequencyCapping(
        { enabled: true, configs: [dspxWpConfig, visxInterstitialConfig] },
        jsDomWindow,
        nowInstantStub,
        noopLogger
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

  describe('persistence', () => {
    it('should not add a frequency cap if no data is stored', () => {
      const frequencyCapping = new FrequencyCapping(
        { enabled: true, persistent: true, configs: [] },
        jsDomWindow,
        nowInstantStub,
        noopLogger
      );
      expect(frequencyCapping.isFrequencyCapped('wp-slot', prebidjs.DSPX)).to.be.false;
    });

    it('should not add a frequency cap if the stored data is invalid', () => {
      jsDomWindow.sessionStorage.setItem('h5v-fc', 'invalid');
      const logger = newNoopLogger();
      const errorSpy = sandbox.spy(logger, 'error');
      const frequencyCapping = new FrequencyCapping(
        { enabled: true, persistent: true, configs: [] },
        jsDomWindow,
        nowInstantStub,
        logger
      );
      expect(frequencyCapping.isFrequencyCapped('wp-slot', prebidjs.DSPX)).to.be.false;
      expect(errorSpy).to.have.been.called;
    });

    it('should resume the frequency cap if the stored data is valid', () => {
      const startTimestamp = 100000;
      const timePassed = 5;
      const waitTime = 3000;
      nowInstantStub.onFirstCall().returns(startTimestamp + timePassed);
      const storedData = {
        caps: [
          {
            ts: startTimestamp,
            wait: waitTime,
            bid: { bidder: prebidjs.DSPX, adUnitCode: wpDomId }
          }
        ]
      };
      jsDomWindow.sessionStorage.setItem('h5v-fc', JSON.stringify(storedData));
      const frequencyCapping = new FrequencyCapping(
        { enabled: true, persistent: true, configs: [dspxWpConfig] },
        jsDomWindow,
        nowInstantStub,
        noopLogger
      );
      expect(frequencyCapping.isFrequencyCapped(wpDomId, prebidjs.DSPX)).to.be.true;
      expect(setTimeoutSpy).to.have.been.calledOnceWithExactly(
        Sinon.match.func,
        waitTime - timePassed
      );
    });

    it('should persist onAuctionEnd events', () => {
      nowInstantStub.returns(100000);
      const frequencyCapping = new FrequencyCapping(
        { enabled: true, persistent: true, configs: [visxInterstitialConfig] },
        jsDomWindow,
        nowInstantStub,
        noopLogger
      );
      frequencyCapping.onAuctionEnd(
        auction([{ bidder: prebidjs.Visx, adUnitCode: interstitialDomId }])
      );
      const storedData = jsDomWindow.sessionStorage.getItem('h5v-fc');
      expect(storedData).to.be.ok;
      const persistedState = JSON.parse(storedData!);
      expect(persistedState).to.be.an('object').and.have.property('caps');
      expect(persistedState.caps).to.be.an('array').and.have.lengthOf(1);
      expect(persistedState.caps[0]).to.deep.equal({
        ts: 100000,
        wait: visxInterstitialConfig.blockedForMs,
        bid: { bidder: prebidjs.Visx, adUnitCode: interstitialDomId }
      });

      expect(frequencyCapping.isFrequencyCapped(interstitialDomId, prebidjs.Visx)).to.be.true;
    });

    it('should persist onBidWon events', () => {
      nowInstantStub.returns(100000);
      const frequencyCapping = new FrequencyCapping(
        { enabled: true, persistent: true, configs: [dspxWpConfig] },
        jsDomWindow,
        nowInstantStub,
        noopLogger
      );
      frequencyCapping.onBidWon(dspxBidResponse);
      const storedData = jsDomWindow.sessionStorage.getItem('h5v-fc');
      expect(storedData).to.be.ok;
      const persistedState = JSON.parse(storedData!);
      expect(persistedState).to.be.an('object').and.have.property('caps');
      expect(persistedState.caps).to.be.an('array').and.have.lengthOf(1);
      expect(persistedState.caps[0]).to.deep.equal({
        ts: 100000,
        wait: dspxWpConfig.blockedForMs,
        bid: {
          bidder: dspxBidResponse.bidder,
          adUnitCode: dspxBidResponse.adUnitCode
        }
      });

      expect(frequencyCapping.isFrequencyCapped(wpDomId, prebidjs.DSPX)).to.be.true;
    });

    it('should persist multiple configs if applicable', () => {
      nowInstantStub.returns(100000);
      const frequencyCapping = new FrequencyCapping(
        {
          enabled: true,
          persistent: true,
          configs: [visxInterstitialConfig, { ...visxInterstitialConfig, bidder: prebidjs.GumGum }]
        },
        jsDomWindow,
        nowInstantStub,
        noopLogger
      );
      frequencyCapping.onAuctionEnd(
        auction([
          { bidder: prebidjs.Visx, adUnitCode: interstitialDomId },
          { bidder: prebidjs.GumGum, adUnitCode: interstitialDomId }
        ])
      );
      const storedData = jsDomWindow.sessionStorage.getItem('h5v-fc');
      expect(storedData).to.be.ok;
      const persistedState = JSON.parse(storedData!);
      expect(persistedState).to.be.an('object').and.have.property('caps');
      expect(persistedState.caps).to.be.an('array').and.have.lengthOf(2);
      expect(persistedState.caps[0]).to.deep.equal({
        ts: 100000,
        wait: visxInterstitialConfig.blockedForMs,
        bid: { bidder: prebidjs.Visx, adUnitCode: interstitialDomId }
      });
      expect(persistedState.caps[1]).to.deep.equal({
        ts: 100000,
        wait: visxInterstitialConfig.blockedForMs,
        bid: { bidder: prebidjs.GumGum, adUnitCode: interstitialDomId }
      });

      expect(frequencyCapping.isFrequencyCapped(interstitialDomId, prebidjs.Visx)).to.be.true;
      expect(frequencyCapping.isFrequencyCapped(interstitialDomId, prebidjs.GumGum)).to.be.true;
    });
  });
});
