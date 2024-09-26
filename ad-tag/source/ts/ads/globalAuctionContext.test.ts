import sinon, { SinonSandbox } from 'sinon';
import { expect, use } from 'chai';
import { createDom } from '../stubs/browserEnvSetup';
import { prebidjs } from '../types/prebidjs';
import { googletag } from '../types/googletag';
import { GlobalAuctionContext } from './globalAuctionContext';
import { createPbjsStub } from '../stubs/prebidjsStubs';
import { createGoogletagStub } from '../stubs/googletagStubs';
import sinonChai from 'sinon-chai';

// setup sinon-chai
use(sinonChai);

describe('Global auction context', () => {
  let dom = createDom();
  let jsDomWindow: Window & prebidjs.IPrebidjsWindow & googletag.IGoogleTagWindow =
    dom.window as any;

  jsDomWindow.pbjs = createPbjsStub();
  jsDomWindow.googletag = createGoogletagStub();

  const sandbox: SinonSandbox = sinon.createSandbox();
  const pbjsOnEventSpy = sandbox.spy(jsDomWindow.pbjs, 'onEvent');
  const googletagAddEventListenerSpy = sandbox.spy(
    jsDomWindow.googletag.pubads(),
    'addEventListener'
  );

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
    new GlobalAuctionContext(jsDomWindow);
    expect(pbjsOnEventSpy).to.have.not.been.called;
    expect(googletagAddEventListenerSpy).to.have.not.been.called;
  });

  describe('bidder disabling', () => {
    it('add auctionEnd event listener', () => {
      const context = new GlobalAuctionContext(jsDomWindow, {
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
      const context = new GlobalAuctionContext(jsDomWindow, {
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

  describe('adRequestThrottling', () => {
    describe('enabled', () => {
      const auctionContextConfig = {
        adRequestThrottling: {
          enabled: true,
          throttle: 10
        }
      };

      it('should instantiate adRequestThrottling', () => {
        const context = new GlobalAuctionContext(jsDomWindow, auctionContextConfig);
        expect(context.adRequestThrottling).to.be.ok;
      });

      it('should never throttle requests in initial state', () => {
        const context = new GlobalAuctionContext(jsDomWindow, auctionContextConfig);
        expect(context.isSlotThrottled('slot-1')).to.be.false;
      });

      it('should add slotRequested event listener', () => {
        new GlobalAuctionContext(jsDomWindow, auctionContextConfig);
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
        const context = new GlobalAuctionContext(jsDomWindow, auctionContextConfig);
        expect(context.adRequestThrottling).to.be.undefined;
      });

      it('should never throttle requests', () => {
        const context = new GlobalAuctionContext(jsDomWindow, auctionContextConfig);
        expect(context.isSlotThrottled('slot-1')).to.be.false;
      });

      it('should not add slotRequested event listener if disabled', () => {
        new GlobalAuctionContext(jsDomWindow, auctionContextConfig);
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
        const context = new GlobalAuctionContext(jsDomWindow, auctionContextConfig);
        expect(context.frequencyCapping).to.be.ok;
      });

      it('should never frequency-cap in initial state', () => {
        const context = new GlobalAuctionContext(jsDomWindow, auctionContextConfig);
        expect(context.isBidderFrequencyCappedOnSlot('slot-1', 'dspx')).to.be.false;
      });

      it('should add bidWon event listener', () => {
        new GlobalAuctionContext(jsDomWindow, auctionContextConfig);
        expect(pbjsOnEventSpy).to.have.been.calledOnce;
        expect(pbjsOnEventSpy).to.have.been.calledOnceWithExactly('bidWon', sinon.match.func);
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
        const context = new GlobalAuctionContext(jsDomWindow, auctionContextConfig);
        expect(context.frequencyCapping).to.be.undefined;
      });

      it('should never throttle/frequency-cap requests', () => {
        const context = new GlobalAuctionContext(jsDomWindow, auctionContextConfig);
        expect(context.isBidderFrequencyCappedOnSlot('wp-slot', 'dspx')).to.be.false;
      });

      it('should not add bidWon event listener if disabled', () => {
        new GlobalAuctionContext(jsDomWindow, auctionContextConfig);
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
        const context = new GlobalAuctionContext(jsDomWindow, auctionContextConfig);
        expect(context.previousBidCpms).to.be.ok;
      });

      it('should add an auctionEnd event listener', () => {
        new GlobalAuctionContext(jsDomWindow, auctionContextConfig);
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
        new GlobalAuctionContext(jsDomWindow, auctionContextConfig);
        expect(pbjsOnEventSpy).to.have.not.been.called;
      });
    });
  });
});
