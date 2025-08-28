import sinon, { SinonSandbox } from 'sinon';
import { expect, use } from 'chai';
import { createDom } from '../stubs/browserEnvSetup';
import { prebidjs } from '../types/prebidjs';
import { googletag } from '../types/googletag';
import { GlobalAuctionContext } from './globalAuctionContext';
import { createPbjsStub } from '../stubs/prebidjsStubs';
import { createGoogletagStub, googleAdSlotStub } from '../stubs/googletagStubs';
import sinonChai from 'sinon-chai';
import { noopLogger } from '../stubs/moliStubs';
import { EventService } from './eventService';
import { Moli } from '../types/moli';

// setup sinon-chai
use(sinonChai);

describe('Global auction context', () => {
  let dom = createDom();
  let jsDomWindow: Window &
    prebidjs.IPrebidjsWindow &
    googletag.IGoogleTagWindow &
    Pick<typeof globalThis, 'Date'> = dom.window as any;

  jsDomWindow.pbjs = createPbjsStub();
  jsDomWindow.googletag = createGoogletagStub();

  const sandbox: SinonSandbox = sinon.createSandbox();
  const eventService = new EventService();
  const eventServiceAddEventListenerSpy = sandbox.spy(eventService, 'addEventListener');
  const pbjsOnEventSpy = sandbox.spy(jsDomWindow.pbjs, 'onEvent');
  const googletagAddEventListenerSpy = sandbox.spy(
    jsDomWindow.googletag.pubads(),
    'addEventListener'
  );

  const makeAuctionContext = (
    config?: Moli.auction.GlobalAuctionContextConfig
  ): GlobalAuctionContext => {
    return new GlobalAuctionContext(jsDomWindow, noopLogger, eventService, config);
  };

  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });

  afterEach(() => {
    // Restore any stubs/spies
    sandbox.reset();
    sandbox.resetHistory();
  });

  it('should not create any event listener if the config is empty', () => {
    // the constructor immediately sets up the event listeners
    makeAuctionContext();
    expect(pbjsOnEventSpy).to.have.not.been.called;
    expect(googletagAddEventListenerSpy).to.have.not.been.called;
  });

  describe('bidder disabling', () => {
    it('add auctionEnd event listener', () => {
      const context = makeAuctionContext({
        biddersDisabling: {
          enabled: true,
          minRate: 0.5,
          minBidRequests: 2,
          reactivationPeriod: 3600000
        }
      });
      expect(pbjsOnEventSpy).to.have.been.calledOnce;
      expect(pbjsOnEventSpy).to.have.been.calledOnceWithExactly('auctionEnd', sinon.match.func);
      expect(context.biddersDisabling).to.be.ok;
    });

    it('should not add auctionEnd event listener if disabled', () => {
      const context = makeAuctionContext({
        biddersDisabling: {
          enabled: false,
          minRate: 0.5,
          minBidRequests: 2,
          reactivationPeriod: 3600000
        }
      });
      expect(pbjsOnEventSpy).to.have.not.been.called;
      expect(context.biddersDisabling).to.be.undefined;
    });
  });

  describe('adUnit frequency capping', () => {
    describe('enabled', () => {
      const auctionContextConfig: Moli.auction.GlobalAuctionContextConfig = {
        frequencyCap: {
          enabled: true,
          configs: [],
          positions: []
        }
      };

      it('should instantiate adUnitFrequencyCapping', () => {
        const context = makeAuctionContext(auctionContextConfig);
        expect(context.frequencyCapping).to.be.ok;
      });

      it('should add slotRenderEnded event listener', () => {
        makeAuctionContext(auctionContextConfig);
        expect(googletagAddEventListenerSpy).to.have.been.calledWithExactly(
          'slotRenderEnded',
          sinon.match.func
        );
      });

      it('should add impressionViewable event listener', () => {
        makeAuctionContext(auctionContextConfig);
        expect(googletagAddEventListenerSpy).to.have.been.calledWithExactly(
          'impressionViewable',
          sinon.match.func
        );
      });

      it('should add afterRequestAds event listener', () => {
        makeAuctionContext(auctionContextConfig);
        expect(eventServiceAddEventListenerSpy).to.have.been.calledOnce;
        expect(eventServiceAddEventListenerSpy).to.have.been.calledOnceWithExactly(
          'afterRequestAds',
          sinon.match.func
        );
      });
    });
  });

  describe('adRequestThrottling', () => {
    describe('enabled', () => {
      const auctionContextConfig = {
        adRequestThrottling: {
          enabled: true,
          throttle: 10
        }
      };

      it('should instantiate adRequestThrottling', () => {
        const context = makeAuctionContext(auctionContextConfig);
        expect(context.adRequestThrottling).to.be.ok;
      });

      it('should never throttle requests in initial state', () => {
        const context = makeAuctionContext(auctionContextConfig);
        expect(context.isSlotThrottled(googleAdSlotStub('slot-1', '/123/slot-1'))).to.be.false;
      });

      it('should add slotRequested event listener', () => {
        makeAuctionContext(auctionContextConfig);
        expect(googletagAddEventListenerSpy).to.have.been.calledOnce;
        expect(googletagAddEventListenerSpy).to.have.been.calledOnceWithExactly(
          'slotRequested',
          sinon.match.func
        );
      });
    });

    describe('disabled', () => {
      const auctionContextConfig = {
        adRequestThrottling: {
          enabled: false,
          throttle: 10
        }
      };

      it('should not instantiate adRequestThrottling', () => {
        const context = makeAuctionContext(auctionContextConfig);
        expect(context.adRequestThrottling).to.be.undefined;
      });

      it('should never throttle requests', () => {
        const context = makeAuctionContext(auctionContextConfig);
        expect(context.isSlotThrottled(googleAdSlotStub('slot-1', '/123/slot-1'))).to.be.false;
      });

      it('should not add slotRequested event listener if disabled', () => {
        makeAuctionContext(auctionContextConfig);
        expect(googletagAddEventListenerSpy).to.have.not.been.called;
      });
    });
  });
  describe('frequencyCapping', () => {
    describe('enabled', () => {
      const auctionContextConfig = {
        frequencyCap: {
          enabled: true,
          configs: [
            {
              bidder: 'dspx',
              domId: 'wp-slot',
              blockedForMs: 10000
            }
          ]
        }
      };

      it('should instantiate frequencyCapping', () => {
        const context = makeAuctionContext(auctionContextConfig);
        expect(context.frequencyCapping).to.be.ok;
      });

      it('should never frequency-cap in initial state', () => {
        const context = makeAuctionContext(auctionContextConfig);
        expect(context.isBidderFrequencyCappedOnSlot('slot-1', 'dspx')).to.be.false;
      });

      it('should add bidWon and auctionEnd event listener', () => {
        makeAuctionContext(auctionContextConfig);
        expect(pbjsOnEventSpy).to.have.been.calledTwice;
        expect(pbjsOnEventSpy).to.have.been.calledWithExactly('bidWon', sinon.match.func);
        expect(pbjsOnEventSpy).to.have.been.calledWithExactly('auctionEnd', sinon.match.func);
      });
    });

    describe('disabled', () => {
      const auctionContextConfig = {
        frequencyCap: {
          enabled: false,
          configs: [
            {
              bidder: 'dspx',
              domId: 'wp-slot',
              blockedForMs: 10000
            }
          ]
        }
      };

      it('should not instantiate frequencyCapping', () => {
        const context = makeAuctionContext(auctionContextConfig);
        expect(context.frequencyCapping).to.be.undefined;
      });

      it('should never throttle/frequency-cap requests', () => {
        const context = makeAuctionContext(auctionContextConfig);
        expect(context.isBidderFrequencyCappedOnSlot('wp-slot', 'dspx')).to.be.false;
      });

      it('should not add bidWon event listener if disabled', () => {
        makeAuctionContext(auctionContextConfig);
        expect(pbjsOnEventSpy).to.have.not.been.called;
      });
    });
  });
  describe('previousFloorPrices', () => {
    describe('enabled', () => {
      const auctionContextConfig = {
        previousBidCpms: {
          enabled: true
        }
      };

      it('should instantiate previous floor price saving', () => {
        const context = makeAuctionContext(auctionContextConfig);
        expect(context.previousBidCpms).to.be.ok;
      });

      it('should add an auctionEnd event listener', () => {
        makeAuctionContext(auctionContextConfig);
        expect(pbjsOnEventSpy).to.have.been.calledOnce;
        expect(pbjsOnEventSpy).to.have.been.calledOnceWithExactly('auctionEnd', sinon.match.func);
      });
    });
    describe('disabled', () => {
      const auctionContextConfig = {
        previousBidCpms: {
          enabled: false
        }
      };

      it('should not add auctionEnd event listener if disabled', () => {
        makeAuctionContext(auctionContextConfig);
        expect(pbjsOnEventSpy).to.have.not.been.called;
      });
    });
  });
});
