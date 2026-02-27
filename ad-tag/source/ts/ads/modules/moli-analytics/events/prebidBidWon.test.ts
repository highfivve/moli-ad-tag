import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { createEventContextStub } from 'ad-tag/stubs/analytics';
import { mapPrebidBidWon } from 'ad-tag/ads/modules/moli-analytics/events/prebidBidWon';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { adPipelineContext } from 'ad-tag/stubs/adPipelineContextStubs';

use(sinonChai);

describe('AnalyticsPrebidBidWon', () => {
  const sandbox = sinon.createSandbox();
  const { jsDomWindow } = createDomAndWindow();
  const adContext = adPipelineContext(jsDomWindow);
  const now = 1000000;

  beforeEach(() => {
    sandbox.useFakeTimers({ now });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('testMapPrebidBidWon', () => {
    const userId = 'user-id';
    const event = {
      auctionId: 'au-001',
      bidderCode: 'rubicon',
      adUnitCode: 'header',
      size: '300x250',
      currency: 'EUR',
      cpm: 0.1,
      status: 'rendered',
      timeToRespond: 100
    };
    const eventContext = {
      ...createEventContextStub(),
      gpid: '/111,222/example/example_header/desktop/example.com'
    };
    adContext.window__.pbjs = {
      ...adContext.window__.pbjs,
      getUserIds: () => ({ pubcid: userId })
    };

    const result = mapPrebidBidWon(event as prebidjs.BidResponse, eventContext, adContext);

    expect(result).to.be.an('object');
    expect(result).to.have.property('v').that.is.a('number').gte(1);
    expect(result).to.have.property('type', 'prebid.bidWon');
    expect(result).to.have.property('publisher', eventContext.publisher);
    expect(result).to.have.property('pageViewId', eventContext.pageViewId);
    expect(result).to.have.property('userId', userId);
    expect(result).to.have.property('timestamp', now);
    expect(result).to.have.property('analyticsLabels', eventContext.analyticsLabels);
    expect(result).to.have.property('data').that.is.an('object');

    const resultData = result.data;

    expect(resultData).to.have.property('auctionId', event.auctionId);
    expect(resultData).to.have.property('gpid', eventContext.gpid);
    expect(resultData).to.have.property('bidderCode', event.bidderCode);
    expect(resultData).to.have.property('adUnitCode', event.adUnitCode);
    expect(resultData).to.have.property('size', event.size);
    expect(resultData).to.have.property('currency', event.currency);
    expect(resultData).to.have.property('cpm', event.cpm);
    expect(resultData).to.have.property('status', event.status);
    expect(resultData).to.have.property('timeToRespond', event.timeToRespond);
  });
});
