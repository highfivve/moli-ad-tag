import sinon, { SinonSandbox } from 'sinon';
import { expect, use } from 'chai';
import { createDomAndWindow } from '../stubs/browserEnvSetup';
import { createGlobalAuctionContext, GlobalAuctionContext } from './globalAuctionContext';
import { createPbjsStub } from '../stubs/prebidjsStubs';
import { createGoogletagStub } from '../stubs/googletagStubs';
import sinonChai from 'sinon-chai';
import { noopLogger } from 'ad-tag/stubs/moliStubs';
import { createEventService } from './eventService';
import { auction } from 'ad-tag/types/moliConfig';

// setup sinon-chai
use(sinonChai);

describe('Global auction context', () => {
  const { jsDomWindow } = createDomAndWindow();

  jsDomWindow.pbjs = createPbjsStub();
  jsDomWindow.googletag = createGoogletagStub();

  const sandbox: SinonSandbox = sinon.createSandbox();
  const eventService = createEventService();
  const eventServiceAddEventListenerSpy = sandbox.spy(eventService, 'addEventListener');
  const pbjsOnEventSpy = sandbox.spy(jsDomWindow.pbjs, 'onEvent');
  const googletagAddEventListenerSpy = sandbox.spy(
    jsDomWindow.googletag.pubads(),
    'addEventListener'
  );

  const makeAuctionContext = (
    config?: auction.GlobalAuctionContextConfig
  ): GlobalAuctionContext => {
    return createGlobalAuctionContext(jsDomWindow, noopLogger, eventService, config);
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
    });
  });

  describe('adUnit frequency capping', () => {
    describe('enabled', () => {
      const auctionContextConfig: auction.GlobalAuctionContextConfig = {
        frequencyCap: {
          enabled: true,
          configs: [],
          positions: []
        }
      };

      it('should add slotRequested event listener', () => {
        makeAuctionContext(auctionContextConfig);
        expect(googletagAddEventListenerSpy).to.have.been.calledWithExactly(
          'slotRequested',
          sinon.match.func
        );
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
        expect(eventServiceAddEventListenerSpy).to.have.been.calledWithExactly(
          'afterRequestAds',
          sinon.match.func
        );
      });

      it('should add beforeRequestAds event listener', () => {
        makeAuctionContext(auctionContextConfig);
        expect(eventServiceAddEventListenerSpy).to.have.been.calledWithExactly(
          'beforeRequestAds',
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

      it('should never throttle requests in initial state', () => {
        const context = makeAuctionContext(auctionContextConfig);
        expect(context.isSlotThrottled('slot-1', '/123/slot-1')).to.be.false;
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

      it('should never throttle requests', () => {
        const context = makeAuctionContext(auctionContextConfig);
        expect(context.isSlotThrottled('slot-1', '/123/slot-1')).to.be.false;
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
