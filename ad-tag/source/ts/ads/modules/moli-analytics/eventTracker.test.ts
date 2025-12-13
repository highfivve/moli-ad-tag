import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createEventTracker } from 'ad-tag/ads/modules/moli-analytics/eventTracker';
import { Events } from 'ad-tag/ads/modules/moli-analytics/types';

use(sinonChai);

describe('EventTracker', () => {
  const sandbox = sinon.createSandbox();
  const url = 'https://example.com/analytics';
  const headers = {
    'Content-Type': 'application/json'
  };
  const events: Events.Page.View[] = new Array(2).fill({
    v: 1,
    type: 'page.view',
    publisher: 'publisher',
    payload: { pageViewId: 'pv-1' }
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('shouldCreateEventTracker', () => {
    const eventTracker = createEventTracker(url, 2, 100);
    expect(eventTracker).an('object');
    expect(eventTracker).have.property('track');
    expect(eventTracker.track).a('function');
  });

  it('shouldProcessFullBatch', () => {
    const fetchStub = sandbox.stub(globalThis, 'fetch').resolves(Response.json({ success: true }));
    const eventTracker = createEventTracker(url, 2, 100);

    eventTracker.track(events[0]);
    expect(fetchStub).not.called;

    eventTracker.track(events[1]);
    expect(fetchStub).calledOnce;
    expect(fetchStub).calledWithMatch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(events)
    });
  });

  it('shouldProcessPartialBatch', () => {
    const clock = sandbox.useFakeTimers();
    const fetchStub = sandbox.stub(globalThis, 'fetch').resolves(Response.json({ success: true }));
    const eventTracker = createEventTracker(url, 5, 100);

    eventTracker.track(events[0]);
    expect(fetchStub).not.called;
    eventTracker.track(events[1]);
    expect(fetchStub).not.called;

    clock.tick(100);
    expect(fetchStub).calledOnce;
    expect(fetchStub).calledWithMatch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(events)
    });

    fetchStub.restore();
    clock.restore();
  });
});
