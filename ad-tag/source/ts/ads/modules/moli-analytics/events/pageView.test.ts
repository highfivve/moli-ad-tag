import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createMoliTag } from 'ad-tag/ads/moli';
import { adPipelineContext } from 'ad-tag/stubs/adPipelineContextStubs';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { createEventContextStub } from 'ad-tag/stubs/analytics';
import { createPbjsStub } from 'ad-tag/stubs/prebidjsStubs';
import { mapPageView } from 'ad-tag/ads/modules/moli-analytics/events/pageView';

use(sinonChai);

describe('AnalyticsPageView', () => {
  const sandbox = sinon.createSandbox();
  const { jsDomWindow } = createDomAndWindow();
  jsDomWindow.moli = createMoliTag(jsDomWindow);
  const adContext = adPipelineContext(jsDomWindow);
  const now = 1000000;

  beforeEach(() => {
    sandbox.useFakeTimers({ now });
    jsDomWindow.pbjs = createPbjsStub();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('testMapPageView', () => {
    const userId = 'user-id';
    const eventContext = createEventContextStub();
    const utmParams = {
      source: 'source',
      medium: 'medium',
      campaign: 'campaign',
      content: 'content',
      term: null
    };

    sandbox.stub(jsDomWindow, 'location').value({
      hostname: 'www.example.com',
      search: Object.entries(utmParams)
        .map(([k, v]) => `utm_${k}=${v || ''}`)
        .join('&')
    });
    adContext.window__.pbjs = {
      ...adContext.window__.pbjs,
      getUserIds: () => ({ pubcid: userId })
    };

    const result = mapPageView(eventContext, adContext);

    expect(result).to.be.an('object');
    expect(result).to.have.property('v').that.is.a('number').gte(1);
    expect(result).to.have.property('type', 'page.view');
    expect(result).to.have.property('publisher', eventContext.publisher);
    expect(result).to.have.property('pageViewId', eventContext.pageViewId);
    expect(result).to.have.property('userId', userId);
    expect(result).to.have.property('timestamp', now);
    expect(result).to.have.property('analyticsLabels', eventContext.analyticsLabels);
    expect(result).to.have.property('data').that.is.an('object');

    const resultData = result.data;
    expect(resultData).to.have.property('sessionId', eventContext.session.getId());
    expect(resultData).to.have.property('device', adContext.labelConfigService__.getDeviceLabel());
    expect(resultData).to.have.property(
      'domain',
      jsDomWindow.location.hostname.replace('www.', '')
    );
    expect(resultData).to.have.property('ua', jsDomWindow.navigator.userAgent);
    expect(resultData).to.have.property('utm').deep.equal(utmParams);
  });
});
