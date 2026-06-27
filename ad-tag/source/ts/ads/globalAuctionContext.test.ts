import sinon, { SinonSandbox } from 'sinon';
import { expect, use } from 'chai';
import { createDomAndWindow } from '../stubs/browserEnvSetup';
import { createGlobalAuctionContext, GlobalAuctionContext } from './globalAuctionContext';
import { createPbjsStub } from '../stubs/prebidjsStubs';
import { createGoogletagStub, googleAdSlotStub } from '../stubs/googletagStubs';
import sinonChai from 'sinon-chai';
import { noopLogger } from 'ad-tag/stubs/moliStubs';
import { createEventService } from './eventService';
import { auction } from 'ad-tag/types/moliConfig';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { LabelCondition } from 'ad-tag/ads/labelConfigService';

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

  /**
   * Builds an `isLabelConditionMet` predicate that evaluates a label condition against a fixed set
   * of active labels - mirrors the real labelConfigService implementation.
   */
  const labelMatcher =
    (...activeLabels: string[]) =>
    (condition: LabelCondition): boolean => {
      const labels = new Set(activeLabels);
      if ('labelAll' in condition) {
        return condition.labelAll.every(label => labels.has(label));
      }
      if ('labelAny' in condition) {
        return condition.labelAny.some(label => labels.has(label));
      }
      return condition.labelNone.every(label => !labels.has(label));
    };

  const makeAuctionContextWithLabels = (
    config: auction.GlobalAuctionContextConfig,
    ...activeLabels: string[]
  ): GlobalAuctionContext => {
    return createGlobalAuctionContext(
      jsDomWindow,
      noopLogger,
      eventService,
      config,
      labelMatcher(...activeLabels)
    );
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

  describe('last winning bidder cache', () => {
    it('should overwrite the cached winning bidder when a newer bid wins on the same slot', () => {
      const context = makeAuctionContext({ trackWinningBidder: { enabled: true } });
      const bidWonHandler = pbjsOnEventSpy.args.find(args => args[0] === 'bidWon')?.[1] as
        | ((bid: prebidjs.BidResponse) => void)
        | undefined;

      expect(bidWonHandler).to.exist;

      bidWonHandler?.({
        adUnitCode: 'slot-1',
        bidderCode: 'appnexus'
      } as unknown as prebidjs.BidResponse);
      expect(context.getLastWinningBidderOfAdUnit('slot-1')).to.equal('appnexus');

      bidWonHandler?.({
        adUnitCode: 'slot-1',
        bidderCode: 'rubicon'
      } as unknown as prebidjs.BidResponse);

      expect(context.getLastWinningBidderOfAdUnit('slot-1')).to.equal('rubicon');
    });

    it('should track bidWon winners if trackWinningBidder is enabled', () => {
      const context = makeAuctionContext({
        trackWinningBidder: {
          enabled: true
        }
      });

      const bidWonHandler = pbjsOnEventSpy.args.find(args => args[0] === 'bidWon')?.[1] as
        | ((bid: prebidjs.BidResponse) => void)
        | undefined;

      expect(pbjsOnEventSpy).to.have.been.calledOnceWithExactly('bidWon', sinon.match.func);
      expect(bidWonHandler).to.exist;

      bidWonHandler?.({
        adUnitCode: 'slot-1',
        bidderCode: 'appnexus'
      } as unknown as prebidjs.BidResponse);
      bidWonHandler?.({
        adUnitCode: 'slot-1',
        bidderCode: 'rubicon'
      } as unknown as prebidjs.BidResponse);

      expect(context.getLastWinningBidderOfAdUnit('slot-1')).to.equal('rubicon');
    });
  });

  describe('bidder disabling', () => {
    it('add auctionEnd event listener', () => {
      makeAuctionContext({
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
      makeAuctionContext({
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
        expect(context.isSlotThrottled(googleAdSlotStub('/123/slot-1', 'slot-1'))).to.be.false;
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
        expect(context.isSlotThrottled(googleAdSlotStub('/123/slot-1', 'slot-1'))).to.be.false;
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

  describe('label-conditioned feature overrides', () => {
    it('uses the feature default when no override matches', () => {
      // previousBidCpms enabled by default; override only applies on the "no-cpms" label
      makeAuctionContextWithLabels(
        {
          previousBidCpms: {
            enabled: true,
            overrides: [{ labelAny: ['no-cpms'], config: { enabled: false } }]
          }
        },
        'home'
      );
      // default (enabled) is used -> auctionEnd listener wired
      expect(pbjsOnEventSpy).to.have.been.calledOnceWithExactly('auctionEnd', sinon.match.func);
    });

    it('applies the first matching override and wires listeners for the selected config', () => {
      // previousBidCpms disabled by default; the matching override enables it
      makeAuctionContextWithLabels(
        {
          previousBidCpms: {
            enabled: false,
            overrides: [{ labelAll: ['article'], config: { enabled: true } }]
          }
        },
        'article'
      );
      // override (enabled) selected -> auctionEnd listener wired even though the default was disabled
      expect(pbjsOnEventSpy).to.have.been.calledOnceWithExactly('auctionEnd', sinon.match.func);
    });

    it('disables a default-enabled feature via an enabled:false override', () => {
      // biddersDisabling enabled by default; override turns it off for the "no-disable" label
      makeAuctionContextWithLabels(
        {
          biddersDisabling: {
            enabled: true,
            minRate: 0.5,
            minBidRequests: 2,
            reactivationPeriod: 3600000,
            overrides: [
              {
                labelAny: ['no-disable'],
                config: {
                  enabled: false,
                  minRate: 0.5,
                  minBidRequests: 2,
                  reactivationPeriod: 3600000
                }
              }
            ]
          }
        },
        'no-disable'
      );
      // override (disabled) selected -> no auctionEnd listener wired
      expect(pbjsOnEventSpy).to.have.not.been.called;
    });

    it('picks the first matching override when several match (first match wins)', () => {
      const context = makeAuctionContextWithLabels(
        {
          frequencyCap: {
            enabled: false,
            overrides: [
              {
                labelAny: ['a'],
                config: {
                  enabled: true,
                  configs: [{ bidder: 'dspx', domId: 'wp-slot', blockedForMs: 10000 }]
                }
              },
              {
                labelAny: ['b'],
                config: {
                  enabled: true,
                  configs: [{ bidder: 'appnexus', domId: 'wp-slot', blockedForMs: 99999 }]
                }
              }
            ]
          }
        },
        'a',
        'b'
      );
      // both override conditions match -> the first entry wins and frequencyCap is enabled
      expect(pbjsOnEventSpy).to.have.been.calledWithExactly('bidWon', sinon.match.func);
      expect(context.isBidderFrequencyCappedOnSlot('wp-slot', 'dspx')).to.be.false;
    });

    it('does nothing for a feature with no base config (override-without-base unsupported)', () => {
      // no frequencyCap key at all -> nothing is resolved, no listeners
      makeAuctionContextWithLabels({}, 'article');
      expect(pbjsOnEventSpy).to.have.not.been.called;
      expect(googletagAddEventListenerSpy).to.have.not.been.called;
    });
  });
});
