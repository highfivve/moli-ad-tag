import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import type { prebidjs } from 'ad-tag/types/prebidjs';
import { createEventContextStub } from 'ad-tag/stubs/analytics';
import { mapPrebidAuctionEnd } from 'ad-tag/ads/modules/moli-analytics/events/prebidAuctionEnd';

use(sinonChai);

describe('AnalyticsAuctionEnd', () => {
  const sandbox = sinon.createSandbox();
  const now = 1000000;

  beforeEach(() => {
    sandbox.useFakeTimers({ now });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('testMapPrebidAuctionEnd', () => {
    const event = {
      adUnitCodes: ['test-ad-unit-code'],
      auctionId: 'test-auction-id',
      adUnits: [
        {
          code: 'ad_header',
          pubstack: { adUnitName: 'header' },
          bids: [],
          mediaTypes: []
        },
        {
          code: 'ad_header',
          pubstack: { adUnitName: 'header' },
          bids: [],
          mediaTypes: []
        },
        {
          code: 'ad_sidebar',
          pubstack: { adUnitName: 'sidebar' },
          bids: [],
          mediaTypes: []
        }
      ],
      bidderRequests: [
        {
          bidderCode: 'rubicon',
          auctionId: 'test-auction-id',
          bids: [
            {
              auctionId: 'test-auction-id',
              bidder: 'rubicon',
              bidderRequestId: 'test-bidder-request-id',
              adUnitCode: 'test-ad-unit-code',
              sizes: [[300, 200]],
              bidId: 'test-bid-id',
              mediaTypes: [],
              src: 'client',
              ortb2: {}
            }
          ],
          ortb2: {
            device: {
              ua: 'test-ua'
            }
          }
        }
      ],
      bidsReceived: [
        {
          ad: 'test-ad-html',
          adId: 'test-ad-id',
          auctionId: 'test-auction-id',
          bidder: 'rubicon',
          bidderCode: 'rubicon',
          adUnitCode: 'ad_header',
          requestId: 'test-request-id',
          transactionId: 'test-transaction-id',
          currency: 'EUR',
          cpm: 0.01,
          size: '300x250',
          mediaType: 'banner',
          timeToRespond: 100
        }
      ],
      winningBids: []
    } as any;
    const eventContext = createEventContextStub();

    const auctionEnd = mapPrebidAuctionEnd(event as prebidjs.event.AuctionObject, eventContext);

    const adUnitCodes = new Set();
    const adUnitsUnique = event.adUnits.filter(adUnit => {
      if (adUnitCodes.has(adUnit.code)) {
        return false;
      }
      adUnitCodes.add(adUnit.code);
      return true;
    });

    expect(auctionEnd).to.be.an('object');
    expect(auctionEnd).to.have.property('v').that.is.a('number').gte(1);
    expect(auctionEnd.v).to.gte(1);
    expect(auctionEnd).to.have.property('type', 'prebid.auctionEnd');
    expect(auctionEnd).to.have.property('publisher', eventContext.publisher);
    expect(auctionEnd).to.have.property('pageViewId', eventContext.pageViewId);
    expect(auctionEnd).to.have.property('timestamp', now);
    expect(auctionEnd).to.have.property('analyticsLabels', eventContext.analyticsLabels);
    expect(auctionEnd).to.have.nested.property('data.auctionId', event.auctionId);

    expect(auctionEnd)
      .to.have.nested.property('data.adUnits')
      .to.be.an('array')
      .that.have.lengthOf(adUnitsUnique.length);

    auctionEnd.data.adUnits.forEach(adUnit => {
      expect(adUnit).to.be.an('object');
      const eventAdUnit = adUnitsUnique.find(item => item.code === adUnit.code);
      expect(adUnit).to.have.property('code', eventAdUnit.code);
      expect(adUnit).to.have.property('adUnitName', eventAdUnit.pubstack.adUnitName);
    });

    expect(auctionEnd)
      .to.have.nested.property('data.bidderRequests')
      .to.be.an('array')
      .that.have.lengthOf(event.bidderRequests.length);

    auctionEnd.data.bidderRequests.forEach((bidderRequest, index) => {
      const eventBidderRequest = event.bidderRequests[index];
      expect(bidderRequest).to.have.property('bidderCode', eventBidderRequest.bidderCode);
      expect(bidderRequest)
        .to.have.property('bids')
        .to.be.an('array')
        .that.have.lengthOf(eventBidderRequest.bids.length);

      bidderRequest.bids.forEach((bid, index) => {
        const eventBid = eventBidderRequest.bids[index];
        expect(bid).to.have.property('adUnitCode', eventBid.adUnitCode);
      });
    });

    expect(auctionEnd)
      .to.have.nested.property('data.bidsReceived')
      .to.be.an('array')
      .that.have.lengthOf(event.bidsReceived.length);

    auctionEnd.data.bidsReceived.forEach((bid, index) => {
      const eventBid = event.bidsReceived[index];
      expect(bid).to.have.property('bidder', eventBid.bidder);
      expect(bid).to.have.property('adUnitCode', eventBid.adUnitCode);
      expect(bid).to.have.property('size', eventBid.size);
      expect(bid).to.have.property('currency', eventBid.currency);
      expect(bid).to.have.property('timeToRespond', eventBid.timeToRespond);
    });
  });
});
