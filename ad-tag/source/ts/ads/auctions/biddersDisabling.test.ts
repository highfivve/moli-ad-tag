import { expect } from 'chai';
import Sinon, { SinonSandbox, SinonFakeTimers } from 'sinon';
import { BiddersDisabling } from './biddersDisabling';
import { prebidjs } from '../../types/prebidjs';
import BidderCode = prebidjs.BidderCode;
import { createDom } from '../../stubs/browserEnvSetup';

type AuctionType = {
  args: {
    bidderRequests: {
      bids: {
        bidderCode: BidderCode;
        bids: { adUnitCode: string }[];
      }[];
    }[];
    bidsReceived: { bidderCode: BidderCode; adUnitCode: string }[];
  };
};

const auction1: AuctionType = {
  args: {
    bidderRequests: [
      {
        bids: [
          { bidderCode: 'gumgum', bids: [{ adUnitCode: 'position1' }] },
          { bidderCode: 'seedtag', bids: [{ adUnitCode: 'position1' }] }
        ]
      }
    ],
    bidsReceived: [{ bidderCode: 'gumgum', adUnitCode: 'position1' }]
  }
};

const auction2: AuctionType = {
  args: {
    bidderRequests: [
      {
        bids: [
          { bidderCode: 'gumgum', bids: [{ adUnitCode: 'position1' }] },
          { bidderCode: 'seedtag', bids: [{ adUnitCode: 'position1' }] }
        ]
      }
    ],
    bidsReceived: [{ bidderCode: 'gumgum', adUnitCode: 'position1' }]
  }
};

const auction3: AuctionType = {
  args: {
    bidderRequests: [
      {
        bids: [
          { bidderCode: 'gumgum', bids: [{ adUnitCode: 'position1' }] },
          {
            bidderCode: 'seedtag',
            bids: [{ adUnitCode: 'position1' }, { adUnitCode: 'position2' }]
          }
        ]
      }
    ],
    bidsReceived: [
      { bidderCode: 'gumgum', adUnitCode: 'position1' },
      { bidderCode: 'seedtag', adUnitCode: 'position1' }
    ]
  }
};

describe('BiddersDisabling', () => {
  const dom = createDom();

  const window: Window = dom.window as any;

  const sandbox: SinonSandbox = Sinon.createSandbox();
  const clock: SinonFakeTimers = sandbox.useFakeTimers();
  let biddersDisablingConfig: BiddersDisabling;

  beforeEach(() => {
    biddersDisablingConfig = new BiddersDisabling(
      {
        enabled: true,
        minBidRequests: 2,
        minRate: 0.5,
        reactivationPeriod: 3600000
      },
      window
    );
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should return false if bidder is not in participationInfo config', () => {
    biddersDisablingConfig.onAuctionEnd(auction1);
    const result = biddersDisablingConfig.isBidderDisabled('position1', 'onetag');
    expect(result).to.be.false;
  });

  it('should return false if bidder should be enabled', () => {
    [auction1, auction2, auction3].forEach(auction => {
      biddersDisablingConfig.onAuctionEnd(auction);
    });

    // three bid requests, three bid received, rate is 1 > 0.5 => gumgum should not be disabled
    const gumGumResult = biddersDisablingConfig.isBidderDisabled('position1', 'gumgum');
    expect(gumGumResult).to.be.false;
  });

  it('should return true if bidder should be disabled', () => {
    [auction1, auction2, auction3].forEach(auction => {
      biddersDisablingConfig.onAuctionEnd(auction);
    });

    // three bid requests, one bid received, rate is 0.33 < 0.5 and bidRequestCount is 3 > 2 => seedtag should be disabled
    const seedTagResult = biddersDisablingConfig.isBidderDisabled('position1', 'seedtag');
    expect(seedTagResult).to.be.true;
  });

  it('should reactivate bidders after passing the reactivation period of disabling them', () => {
    [auction1, auction2, auction3].forEach(auction => {
      biddersDisablingConfig.onAuctionEnd(auction);
    });

    // three bid requests, one bid received, rate is 0.33 < 0.5 and bidRequestCount is 3 > 2 => seedtag should be disabled
    const seedTagResult = biddersDisablingConfig.isBidderDisabled('position1', 'seedtag');
    expect(seedTagResult).to.be.true;

    // 1 hour didn't pass yet, seedtag should still be disabled
    clock.tick(3599999);
    const seedTagResultBeforeAnHour = biddersDisablingConfig.isBidderDisabled(
      'position1',
      'seedtag'
    );
    expect(seedTagResultBeforeAnHour).to.be.true;

    // 1 hour passed, seedtag should be reactivated
    clock.tick(3600000);
    const seedTagResultAfterAnHour = biddersDisablingConfig.isBidderDisabled(
      'position1',
      'seedtag'
    );
    expect(seedTagResultAfterAnHour).to.be.false;
  });
});
