import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { mapPrebidBidWon } from 'ad-tag/ads/modules/moli-analytics/events/prebidBidWon';
import type { Events } from 'ad-tag/ads/modules/moli-analytics/types';
import { prebidjs } from 'ad-tag/types/prebidjs';

use(sinonChai);

describe('AnalyticsPrebidBidWon', () => {
  const sandbox = sinon.createSandbox();
  const now = 1000000;

  beforeEach(() => {
    sandbox.useFakeTimers({ now });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('testMapPrebidBidWon', () => {
    const publisher = 'test-publisher';
    const analyticsLabels: Events.AnalyticsLabels = {
      ab_test: 'test-ab',
      variant: 'test-variant'
    };

    const event = {
      auctionId: 'test-auction-id',
      bidderCode: 'test-bidder-code',
      adUnitCode: 'test-ad-unit-code',
      transactionId: 'test-transaction-id',
      requestId: 'test-request-id',
      currency: 'EUR',
      cpm: 0.1,
      size: '300x250',
      status: 'rendered',
      timeToRespond: 100
    };

    const result = mapPrebidBidWon(event as prebidjs.BidResponse, publisher, analyticsLabels);

    expect(result).to.be.an('object');
    expect(result).to.have.property('v').that.is.a('number').gte(1);
    expect(result).to.have.property('type', 'prebid.bidWon');
    expect(result).to.have.property('publisher', publisher);
    expect(result).to.have.property('timestamp', now);
    expect(result).to.have.nested.property('payload.timestamp', new Date(now).toISOString());
    expect(result).to.have.nested.property('payload.data.analyticsLabels', analyticsLabels);
    expect(result).to.have.nested.property('payload.data.auctionId', event.auctionId);
    expect(result).to.have.nested.property('payload.data.bidderCode', event.bidderCode);
    expect(result).to.have.nested.property('payload.data.adUnitCode', event.adUnitCode);
    expect(result).to.have.nested.property('payload.data.transactionId', event.transactionId);
    expect(result).to.have.nested.property('payload.data.requestId', event.requestId);
    expect(result).to.have.nested.property('payload.data.currency', event.currency);
    expect(result).to.have.nested.property('payload.data.cpm', event.cpm);
    expect(result).to.have.nested.property('payload.data.size', event.size);
    expect(result).to.have.nested.property('payload.data.status', event.status);
    expect(result).to.have.nested.property('payload.data.timeToRespond', event.timeToRespond);
  });
});
