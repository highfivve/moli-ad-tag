import { expect } from 'chai';
import { SinonSandbox, createSandbox, SinonStub, SinonFakeTimers } from 'sinon';
import { BidderState } from '../globalAuctionContext';
import { BiddersDisablingConfig } from './biddersDisabling';
import { prebidjs } from '../../types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { noopLogger } from '../../stubs/moliStubs';
import * as Sinon from 'sinon';

describe('BiddersDisablingConfig', () => {
  let sandbox: SinonSandbox;
  let clock: SinonFakeTimers;

  beforeEach(() => {
    sandbox = createSandbox();
    clock = sandbox.useFakeTimers();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('shouldDisableBidder method', () => {
    it('should return true if bidder should be disabled', () => {
      const participationInfo = new Map<string, Map<BidderCode, BidderState>>();
      const bidderState: BidderState = {
        disabled: false,
        bidRequestCount: 7,
        bidReceivedCount: 3
      };
      const biddersDisablingConfig = new BiddersDisablingConfig(
        5,
        0.5,
        participationInfo,
        1000,
        noopLogger
      );

      const result = biddersDisablingConfig.shouldDisableBidder(bidderState);

      expect(result).to.be.true;
    });

    it('should return false if bidder should not be disabled', () => {
      const participationInfo = new Map<string, Map<BidderCode, BidderState>>();
      const bidderState: BidderState = {
        disabled: false,
        bidRequestCount: 4,
        bidReceivedCount: 3
      };
      const biddersDisablingConfig = new BiddersDisablingConfig(
        5,
        0.5,
        participationInfo,
        1000,
        noopLogger
      );

      const result = biddersDisablingConfig.shouldDisableBidder(bidderState);

      expect(result).to.be.false;
    });
  });

  describe('disableBidder method', () => {
    it('should disable the bidder', () => {
      const infoSpy = Sinon.spy();
      const participationInfo = new Map<string, Map<BidderCode, BidderState>>();
      const bidderState: BidderState = {
        disabled: false,
        bidRequestCount: 7,
        bidReceivedCount: 3
      };
      participationInfo.set('position1', new Map([['gumgum', bidderState]]));

      const biddersDisablingConfig = new BiddersDisablingConfig(5, 0.5, participationInfo, 10000, {
        ...noopLogger,
        info: infoSpy
      });

      biddersDisablingConfig.disableBidder('position1', 'gumgum');
      const disabledBidderState = participationInfo.get('position1')?.get('gumgum');

      expect(disabledBidderState?.disabled).to.be.true;
      expect(infoSpy.calledOnceWithExactly('Bidder gumgum for position position1 is now disabled.'))
        .to.be.true;
    });
  });

  describe('enableBidder method', () => {
    it('should enable the bidder', () => {
      const infoSpy = Sinon.spy();
      const participationInfo = new Map<string, Map<BidderCode, BidderState>>();
      const bidderState: BidderState = {
        disabled: true,
        bidRequestCount: 6,
        bidReceivedCount: 3
      };
      participationInfo.set('position1', new Map([['gumgum', bidderState]]));

      const biddersDisablingConfig = new BiddersDisablingConfig(5, 0.5, participationInfo, 1000, {
        ...noopLogger,
        info: infoSpy
      });
      biddersDisablingConfig.enableBidder('position1', 'gumgum');

      const enabledBidderState = participationInfo.get('position1')?.get('gumgum');

      expect(enabledBidderState?.disabled).to.be.false;
      expect(infoSpy.calledOnceWithExactly('Bidder gumgum for position position1 is now enabled.'))
        .to.be.true;
    });
  });

  describe('deactivateBidderForTTL method', () => {
    it('should deactivate bidders if they should be disabled', () => {
      const participationInfo = new Map<string, Map<BidderCode, BidderState>>();
      const bidderState1: BidderState = {
        disabled: false,
        bidRequestCount: 7,
        bidReceivedCount: 3
      };
      const bidderState2: BidderState = {
        disabled: false,
        bidRequestCount: 4,
        bidReceivedCount: 3
      };
      const bidderState3: BidderState = {
        disabled: false,
        bidRequestCount: 4,
        bidReceivedCount: 0
      };
      participationInfo.set('position1', new Map([['gumgum', bidderState1]]));
      participationInfo.set(
        'position2',
        new Map([
          ['appnexus', bidderState2],
          ['adagio', bidderState3]
        ])
      );

      const biddersDisablingConfig = new BiddersDisablingConfig(
        5,
        0.5,
        participationInfo,
        1000,
        noopLogger
      );

      const disableBidderSpy = sandbox.spy(biddersDisablingConfig, 'disableBidder');
      const enableBidderSpy = sandbox.spy(biddersDisablingConfig, 'enableBidder');

      biddersDisablingConfig.deactivateBidderForTTL();

      expect(disableBidderSpy.calledWithExactly('position1', 'gumgum')).to.be.true; // rate is less than 0.5
      expect(disableBidderSpy.calledWithExactly('position2', 'adagio')).to.be.false; // rate is less than 0.5 but bidRequestCount is less than 5
      expect(enableBidderSpy.calledWithExactly('position2', 'appnexus')).to.be.false; // rate is more than 0.5

      clock.tick(1001);

      // re-enable gumgum after 1000ms
      expect(enableBidderSpy.calledOnceWithExactly('position1', 'gumgum')).to.be.true;
    });
  });
});
