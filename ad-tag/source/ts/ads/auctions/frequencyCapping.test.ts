import { expect, use } from 'chai';
import {
  createFrequencyCapping,
  FrequencyCapping,
  PersistedFrequencyCappingState
} from './frequencyCapping';
import { prebidjs } from '../../types/prebidjs';
import { createDomAndWindow } from '../../stubs/browserEnvSetup';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import BidResponse = prebidjs.BidResponse;
import { auction } from 'ad-tag/types/moliConfig';
import { newNoopLogger, noopLogger } from 'ad-tag/stubs/moliStubs';
import { googletag } from 'ad-tag/types/googletag';
use(sinonChai);

describe('FrequencyCapping', () => {
  const { jsDomWindow } = createDomAndWindow();

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();
  const setTimeoutSpy = sandbox.spy(jsDomWindow, 'setTimeout');
  const nowInstantStub = sandbox.stub<any, number>().returns(100000);

  const wpDomId = 'wp-slot';
  const wpAdUnitPath = '/123,456/example/wp-slot';
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

  const slotRenderEndedEvent = (
    isEmpty: boolean,
    adUnitPath: string,
    format?: string
  ): googletag.events.ISlotRenderEndedEvent =>
    ({
      isEmpty,
      slot: {
        getAdUnitPath: () => adUnitPath,
        getTargeting(key: string): string[] {
          return key === 'f' && format ? [format] : [];
        }
      }
    }) as googletag.events.ISlotRenderEndedEvent;

  const impressionViewableEvent = (
    adUnitPath: string,
    format?: string
  ): googletag.events.IImpressionViewableEvent =>
    ({
      slot: {
        getAdUnitPath: () => adUnitPath,
        getTargeting(key: string): string[] {
          return key === 'f' && format ? [format] : [];
        }
      }
    }) as googletag.events.IImpressionViewableEvent;

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
    const frequencyCapping = createFrequencyCapping(
      { enabled: true, configs: [] },
      jsDomWindow,
      nowInstantStub,
      noopLogger
    );
    expect(frequencyCapping.isFrequencyCapped('wp-slot', prebidjs.DSPX)).to.be.false;
    expect(jsDomWindow.sessionStorage.getItem('h5v-fc')).to.be.null;
  });

  it('should not add a frequency cap if no events have been fired', () => {
    const frequencyCapping = createFrequencyCapping(
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
      frequencyCapping = createFrequencyCapping(
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
      frequencyCapping = createFrequencyCapping(
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

  describe('position frequency capping', () => {
    const makeFrequencyCapping = (configs: auction.PositionFrequencyConfig[]) =>
      createFrequencyCapping(
        { enabled: true, configs: [], positions: configs },
        jsDomWindow,
        nowInstantStub,
        noopLogger
      );

    describe('requestAds delay', () => {
      it('should frequency cap if the slot has a delay configured and minimum number of ad requests have not been reached', () => {
        const frequencyCapping = makeFrequencyCapping([
          { adUnitPath: wpAdUnitPath, conditions: { delay: { minRequestAds: 2 } } }
        ]);

        frequencyCapping.afterRequestAds();
        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.true;
      });

      it('should not frequency cap if the slot has a delay configured but the minimum request ads have been reached', () => {
        const frequencyCapping = makeFrequencyCapping([
          { adUnitPath: wpAdUnitPath, conditions: { delay: { minRequestAds: 2 } } }
        ]);
        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.true;

        frequencyCapping.afterRequestAds();
        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.true;

        frequencyCapping.afterRequestAds();
        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.false;
      });
    });

    describe('pacing by requestAds', () => {
      it('should frequency cap if the slot has a pacing request ads configured and not enough ad requests have been made since the last impressions', () => {
        const frequencyCapping = makeFrequencyCapping([
          { adUnitPath: wpAdUnitPath, conditions: { pacingRequestAds: { requestAds: 2 } } }
        ]);

        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.false;
        frequencyCapping.onSlotRenderEnded(slotRenderEndedEvent(false, wpAdUnitPath));
        frequencyCapping.afterRequestAds();
        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.true;
        frequencyCapping.afterRequestAds();
        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.false;
      });

      it('should use slotRenderEnded events for pacing by request ads if the format is not interstitial', () => {
        const frequencyCapping = makeFrequencyCapping([
          { adUnitPath: wpAdUnitPath, conditions: { pacingRequestAds: { requestAds: 2 } } }
        ]);
        const format = googletag.enums.OutOfPageFormat.BOTTOM_ANCHOR.toString();

        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.false;
        frequencyCapping.onSlotRenderEnded(slotRenderEndedEvent(false, wpAdUnitPath, format));
        frequencyCapping.afterRequestAds();

        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.true;

        frequencyCapping.afterRequestAds();
        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.false;
      });

      it('should use impressionViewable events for pacing by request ads if the format is interstitial', () => {
        const frequencyCapping = makeFrequencyCapping([
          {
            adUnitPath: interstitialDomId,
            conditions: { pacingRequestAds: { requestAds: 2 } }
          }
        ]);
        const format = googletag.enums.OutOfPageFormat.INTERSTITIAL.toString();

        expect(frequencyCapping.isAdUnitCapped(interstitialDomId)).to.be.false;

        // this has no effect
        frequencyCapping.onSlotRenderEnded(slotRenderEndedEvent(false, interstitialDomId, format));
        frequencyCapping.afterRequestAds();
        expect(frequencyCapping.isAdUnitCapped(interstitialDomId)).to.be.false;

        // this should cap the ad unit
        frequencyCapping.onImpressionViewable(impressionViewableEvent(interstitialDomId, format));
        expect(frequencyCapping.isAdUnitCapped(interstitialDomId)).to.be.true;

        frequencyCapping.afterRequestAds();
        frequencyCapping.afterRequestAds();
        expect(frequencyCapping.isAdUnitCapped(interstitialDomId)).to.be.false;
      });
    });

    describe('pacing by interval', () => {
      it('should frequency cap if the slot has a pacing interval configured', () => {
        nowInstantStub.returns(100000);
        const frequencyCapping = makeFrequencyCapping([
          {
            adUnitPath: wpAdUnitPath,
            conditions: { pacingInterval: { intervalInMs: 30000, maxImpressions: 2 } }
          }
        ]);

        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.false;
        frequencyCapping.onSlotRenderEnded(slotRenderEndedEvent(false, wpAdUnitPath));
        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.false;
        frequencyCapping.onSlotRenderEnded(slotRenderEndedEvent(false, wpAdUnitPath));
        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.true;

        sandbox.clock.tick(30100);
        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.false;
      });

      it('should update the configs when the ad unit path variables are updated', () => {
        nowInstantStub.returns(100000);
        const adUnitPathWithVars = '/123,456/example/{device}';
        const adUnitPathWithVarsResolved = '/123,456/example/mobile';
        const frequencyCapping = makeFrequencyCapping([
          {
            adUnitPath: adUnitPathWithVars,
            conditions: { pacingInterval: { intervalInMs: 30000, maxImpressions: 2 } }
          }
        ]);

        frequencyCapping.updateAdUnitPaths({ device: 'mobile' });
        expect(frequencyCapping.isAdUnitCapped(adUnitPathWithVarsResolved)).to.be.false;
        frequencyCapping.onSlotRenderEnded(slotRenderEndedEvent(false, adUnitPathWithVarsResolved));
        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.false;
        frequencyCapping.onSlotRenderEnded(slotRenderEndedEvent(false, adUnitPathWithVarsResolved));
        expect(frequencyCapping.isAdUnitCapped(adUnitPathWithVarsResolved)).to.be.true;

        sandbox.clock.tick(30100);
        expect(frequencyCapping.isAdUnitCapped(adUnitPathWithVarsResolved)).to.be.false;
      });
    });

    describe('multiple position frequency capping conditions', () => {
      it('should not cap if domId without any configuration is requested', () => {
        const frequencyCapping = makeFrequencyCapping([
          { adUnitPath: wpDomId, conditions: { delay: { minRequestAds: 1 } } }
        ]);

        expect(frequencyCapping.isFrequencyCapped('another-slot', prebidjs.DSPX)).to.be.false;
      });

      it('should not cap if no conditions are set', () => {
        const frequencyCapping = makeFrequencyCapping([{ adUnitPath: wpDomId, conditions: {} }]);

        expect(frequencyCapping.isFrequencyCapped(wpDomId, prebidjs.DSPX)).to.be.false;
      });

      it('should not cap if all conditions are met', () => {
        const frequencyCapping = makeFrequencyCapping([
          {
            adUnitPath: wpAdUnitPath,
            conditions: {
              delay: { minRequestAds: 1 },
              pacingRequestAds: { requestAds: 2 },
              pacingInterval: { intervalInMs: 15000, maxImpressions: 2 }
            }
          }
        ]);

        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.true;
        frequencyCapping.afterRequestAds();
        frequencyCapping.afterRequestAds();
        expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.false;
      });
    });
  });

  describe('persistence', () => {
    it('should not add a frequency cap if no data is stored', () => {
      const frequencyCapping = createFrequencyCapping(
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
      const frequencyCapping = createFrequencyCapping(
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
      const storedData: PersistedFrequencyCappingState = {
        caps: [
          {
            ts: startTimestamp,
            wait: waitTime,
            bid: { bidder: prebidjs.DSPX, adUnitCode: wpDomId }
          }
        ],
        pCaps: {},
        requestAds: 0
      };
      jsDomWindow.sessionStorage.setItem('h5v-fc', JSON.stringify(storedData));
      const frequencyCapping = createFrequencyCapping(
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

    it('should resume pacing interval frequency cap if the stored data is valid', () => {
      const startTimestamp = 100000;
      const timePassed = 5;
      const waitTime = 3000;
      nowInstantStub.onFirstCall().returns(startTimestamp + timePassed);
      const storedData: PersistedFrequencyCappingState = {
        caps: [],
        pCaps: {
          [wpAdUnitPath]: [{ ts: startTimestamp, wait: waitTime }]
        },
        requestAds: 1
      };
      jsDomWindow.sessionStorage.setItem('h5v-fc', JSON.stringify(storedData));
      const frequencyCapping = createFrequencyCapping(
        {
          enabled: true,
          persistent: true,
          configs: [],
          positions: [
            {
              adUnitPath: wpAdUnitPath,
              conditions: { pacingInterval: { maxImpressions: 1, intervalInMs: 10000 } }
            }
          ]
        },
        jsDomWindow,
        nowInstantStub,
        noopLogger
      );
      expect(frequencyCapping.isAdUnitCapped(wpAdUnitPath)).to.be.true;
      expect(setTimeoutSpy).to.have.been.calledOnceWithExactly(
        Sinon.match.func,
        waitTime - timePassed
      );
    });

    it('should persist onAuctionEnd events', () => {
      nowInstantStub.returns(100000);
      const frequencyCapping = createFrequencyCapping(
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
      const frequencyCapping = createFrequencyCapping(
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

    it('should persist on afterRequestAds events', () => {
      nowInstantStub.returns(100000);
      const frequencyCapping = createFrequencyCapping(
        { enabled: true, persistent: true, configs: [] },
        jsDomWindow,
        nowInstantStub,
        noopLogger
      );
      frequencyCapping.afterRequestAds();
      const storedData = jsDomWindow.sessionStorage.getItem('h5v-fc');
      expect(storedData).to.be.ok;
      const persistedState = JSON.parse(storedData!);
      expect(persistedState).to.be.an('object').and.have.property('requestAds');
      expect(persistedState.requestAds).to.be.equal(1);
    });

    it('should persist multiple configs if applicable', () => {
      nowInstantStub.returns(100000);
      const frequencyCapping = createFrequencyCapping(
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
