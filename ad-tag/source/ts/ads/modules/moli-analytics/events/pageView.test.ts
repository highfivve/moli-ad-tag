import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { mapPageView } from 'ad-tag/ads/modules/moli-analytics/events/pageView';
import { adPipelineContext } from 'ad-tag/stubs/adPipelineContextStubs';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import type { Events } from 'ad-tag/ads/modules/moli-analytics/types';

use(sinonChai);

describe('AnalyticsPageView', () => {
  const sandbox = sinon.createSandbox();
  const { jsDomWindow } = createDomAndWindow();
  const context = adPipelineContext(jsDomWindow);
  const now = 1000000;

  beforeEach(() => {
    sandbox.useFakeTimers({ now });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('testMapPageView', () => {
    const publisher = 'test-publisher';
    const sessionId = 'test-session-id';
    const pageViewId = 'test-page-view-id';
    const analyticsLabels: Events.AnalyticsLabels = {
      ab_test: 'test-ab',
      variant: 'test-variant'
    };
    const utmParams = {
      source: 'source',
      medium: 'medium',
      campaign: 'campaign',
      content: 'content',
      term: null
    };

    sandbox.stub(jsDomWindow, 'location').value({
      hostname: 'example.com',
      search: Object.entries(utmParams)
        .map(([k, v]) => `utm_${k}=${v || ''}`)
        .join('&')
    });

    const result = mapPageView(context, publisher, sessionId, pageViewId, analyticsLabels);

    expect(result).to.be.an('object');
    expect(result).to.have.property('v').that.is.a('number').gte(1);
    expect(result).to.have.property('type', 'page.view');
    expect(result).to.have.property('publisher', publisher);
    expect(result).to.have.property('timestamp', now);
    expect(result).to.have.nested.property('payload.timestamp', new Date(now).toISOString());
    expect(result).to.have.nested.property('payload.data.sessionId', sessionId);
    expect(result).to.have.nested.property('payload.data.pageViewId', pageViewId);
    expect(result).to.have.nested.property('payload.data.analyticsLabels', analyticsLabels);
    expect(result).to.have.nested.property('payload.data.domain', jsDomWindow.location.hostname);
    expect(result).to.have.nested.property('payload.data.ua', jsDomWindow.navigator.userAgent);
    expect(result).to.have.nested.property('payload.data.utm').deep.equal(utmParams);
  });
});
