import { expect } from 'chai';
import { eventMapper } from 'ad-tag/ads/modules/moli-analytics/events';

describe('AnalyticsEvents', () => {
  it('testEventMapper', () => {
    expect(eventMapper).to.be.an('object');
    expect(eventMapper).to.have.property('prebid').that.is.an('object');
    expect(eventMapper).to.have.property('gpt').that.is.an('object');
    expect(eventMapper).to.have.property('page').that.is.an('object');
    expect(eventMapper.prebid).to.have.property('auctionEnd').that.is.a('function');
    expect(eventMapper.prebid).to.have.property('bidWon').that.is.a('function');
    expect(eventMapper.gpt).to.have.property('slotRenderEnded').that.is.a('function');
    expect(eventMapper.page).to.have.property('view').that.is.a('function');
  });
});
