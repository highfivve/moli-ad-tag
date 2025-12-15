import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { mapGPTSlotRenderEnded } from 'ad-tag/ads/modules/moli-analytics/events/gptSlotRenderEnded';
import { adPipelineContext } from 'ad-tag/stubs/adPipelineContextStubs';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import type { googletag } from 'ad-tag/types/googletag';
import type { Events } from 'ad-tag/ads/modules/moli-analytics/types';

use(sinonChai);

describe('AnalyticsGPTSlotRenderEnded', () => {
  const sandbox = sinon.createSandbox();
  const { jsDomWindow } = createDomAndWindow();
  const auctionId = 'test-auction-id';
  const context = adPipelineContext(jsDomWindow, { auctionId__: auctionId });
  const now = 1000000;

  beforeEach(() => {
    sandbox.useFakeTimers({ now });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('testMapGPTSlotRenderEnded', () => {
    const event = {
      slot: {
        getAdUnitPath: sandbox.stub().returns('/test/ad/unit/path')
      } as any,
      isEmpty: false,
      size: [300, 200]
    } as googletag.events.ISlotRenderEndedEvent;

    const publisher = 'test-publisher';
    const sessionId = 'test-session-id';
    const pageViewId = 'test-page-view-id';
    const analyticsLabels: Events.AnalyticsLabels = {
      ab_test: 'test-ab',
      variant: 'test-variant'
    };

    const result = mapGPTSlotRenderEnded(
      event,
      context,
      publisher,
      sessionId,
      pageViewId,
      analyticsLabels
    );

    expect(result).to.be.an('object');
    expect(result).to.have.property('v').that.is.a('number').gte(1);
    expect(result).to.have.property('type', 'gpt.slotRenderEnded');
    expect(result).to.have.property('publisher', publisher);
    expect(result).to.have.property('timestamp', now);
    expect(result).to.have.nested.property('payload.timestamp', new Date(now).toISOString());
    expect(result).to.have.nested.property('payload.data.adUnitPath', event.slot.getAdUnitPath());
    expect(result).to.have.nested.property('payload.data.isEmpty', event.isEmpty);
    expect(result).to.have.nested.property('payload.data.size', event.size);
    expect(result).to.have.nested.property('payload.data.sessionId', sessionId);
    expect(result).to.have.nested.property('payload.data.pageViewId', pageViewId);
    expect(result).to.have.nested.property('payload.data.analyticsLabels', analyticsLabels);
    expect(result).to.have.nested.property('payload.prebidRef.auctionId', auctionId);
  });
});
