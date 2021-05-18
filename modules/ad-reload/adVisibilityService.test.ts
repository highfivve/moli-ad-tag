import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createGoogletagStub, googleAdSlotStub } from '@highfivve/ad-tag/lib/stubs/googletagStubs';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import { AdVisibilityService } from './adVisibilityService';
import { UserActivityService } from './userActivityService';
import { noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { googletag } from '@highfivve/ad-tag';
import ISlotVisibilityChangedEvent = googletag.events.ISlotVisibilityChangedEvent;
import { RefreshIntervalOverrides } from './index';

use(sinonChai);

describe('AdVisibilityService', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window & googletag.IGoogleTagWindow = dom.window as any;
  (jsDomWindow as any).id = Math.random();
  const logger = noopLogger;

  beforeEach(() => {
    jsDomWindow.googletag = createGoogletagStub();
  });

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    (jsDomWindow as any).id = Math.random();
    sandbox.reset();
  });

  const adRefreshInterval = 20000;
  const tickInterval = 1000;
  const createAdVisibilityService = (
    overrides: RefreshIntervalOverrides = {}
  ): AdVisibilityService => {
    const userActivityService = new UserActivityService(jsDomWindow, { level: 'strict' }, logger);

    // decouple logic from actual userActivityService
    sandbox.stub(userActivityService);

    return new AdVisibilityService(
      userActivityService,
      adRefreshInterval,
      overrides,
      false,
      jsDomWindow,
      logger
    );
  };

  it('should setup a 1s interval to check ad visibility', () => {
    const setIntervalSpy = sandbox.spy(dom.window, 'setInterval');

    createAdVisibilityService();

    expect(setIntervalSpy).to.have.been.calledOnce;
    expect(setIntervalSpy).to.have.been.calledWithMatch(
      Sinon.match.func,
      AdVisibilityService.updateVisibilityInterval
    );
  });

  it('should add a pubads() event listener if useIntersectionObserver is false', () => {
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    createAdVisibilityService();

    expect(listenerSpy).to.have.been.calledOnce;
    expect(listenerSpy).to.have.been.calledWithMatch('slotVisibilityChanged', Sinon.match.func);
  });

  it('should track a googletag slot if the element is present in DOM', () => {
    const service = createAdVisibilityService();
    const slot = googleAdSlotStub('foo', 'foo');

    sandbox
      .stub(jsDomWindow.document, 'getElementById')
      .returns(jsDomWindow.document.createElement('div'));

    expect(service.isSlotTracked(slot.getSlotElementId())).to.be.false;

    service.trackSlot(slot, sandbox.stub);

    expect(service.isSlotTracked(slot.getSlotElementId())).to.be.true;
  });

  it('should not track a googletag slot if the element is NOT present in DOM', () => {
    const service = createAdVisibilityService();
    const slot = googleAdSlotStub('foo', 'foo');

    expect(service.isSlotTracked(slot.getSlotElementId())).to.be.false;

    service.trackSlot(slot, sandbox.stub);

    expect(service.isSlotTracked(slot.getSlotElementId())).to.be.false;
  });

  it('should remove slot tracking first if the same slot should be tracked again', () => {
    const service = createAdVisibilityService();
    const slot = googleAdSlotStub('foo', 'foo');
    const removeTrackingSpy = sandbox.spy(service, 'removeSlotTracking');

    sandbox
      .stub(jsDomWindow.document, 'getElementById')
      .returns(jsDomWindow.document.createElement('div'));

    expect(service.isSlotTracked(slot.getSlotElementId())).to.be.false;

    service.trackSlot(slot, sandbox.stub);

    expect(service.isSlotTracked(slot.getSlotElementId())).to.be.true;

    service.trackSlot(slot, sandbox.stub);

    expect(removeTrackingSpy).to.have.been.calledOnceWithExactly(slot);
    expect(service.isSlotTracked(slot.getSlotElementId())).to.be.true;
  });

  it('should call the refreshCallback after the specified time to refresh', () => {
    sandbox.useFakeTimers();

    const addEventListenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    // performance.now needs to be stubbed "by hand":
    // https://www.bountysource.com/issues/50501976-fake-timers-in-sinon-doesn-t-work-with-performance-now
    const performanceNowStub = sandbox.stub(jsDomWindow.performance, 'now');

    Array.from({ length: 30 }).forEach((_, index) => {
      performanceNowStub.onCall(index).returns((index + 1) * 1000);
    });

    const service = createAdVisibilityService();

    const slot = googleAdSlotStub('foo', 'foo');

    expect(addEventListenerSpy).to.have.been.calledOnce;
    expect(addEventListenerSpy).to.have.been.calledWithMatch(
      'slotVisibilityChanged',
      Sinon.match.func
    );

    const visibilityChangedListener: (event: ISlotVisibilityChangedEvent) => void =
      addEventListenerSpy.args[0][1];

    sandbox
      .stub(jsDomWindow.document, 'getElementById')
      .returns(jsDomWindow.document.createElement('div'));

    const refreshCallback = sandbox.stub();
    service.trackSlot(slot, refreshCallback);

    visibilityChangedListener({ inViewPercentage: 99, slot } as ISlotVisibilityChangedEvent);

    sandbox.clock.tick(adRefreshInterval + tickInterval);

    // initial call for ad slot visibility + 21 calls accounting for 1..20s + final call when refreshing the slot
    expect(performanceNowStub).to.have.callCount(1 + 21 + 1);

    expect(refreshCallback).to.have.been.calledOnceWithExactly(slot);
  });

  it('should call the refreshCallback after the specified time in the override config', () => {
    const newRefreshInterval = 10000;
    sandbox.useFakeTimers();

    const addEventListenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    // performance.now needs to be stubbed "by hand":
    // https://www.bountysource.com/issues/50501976-fake-timers-in-sinon-doesn-t-work-with-performance-now
    const performanceNowStub = sandbox.stub(jsDomWindow.performance, 'now');

    Array.from({ length: 15 }).forEach((_, index) => {
      performanceNowStub.onCall(index).returns((index + 1) * 1000);
    });

    const service = createAdVisibilityService({ bar: newRefreshInterval });

    const slot = googleAdSlotStub('bar', 'bar');

    expect(addEventListenerSpy).to.have.been.calledOnce;
    expect(addEventListenerSpy).to.have.been.calledWithMatch(
      'slotVisibilityChanged',
      Sinon.match.func
    );

    const visibilityChangedListener: (event: ISlotVisibilityChangedEvent) => void =
      addEventListenerSpy.args[0][1];

    sandbox
      .stub(jsDomWindow.document, 'getElementById')
      .returns(jsDomWindow.document.createElement('div'));

    const refreshCallback = sandbox.stub();
    service.trackSlot(slot, refreshCallback);

    visibilityChangedListener({ inViewPercentage: 99, slot } as ISlotVisibilityChangedEvent);

    sandbox.clock.tick(newRefreshInterval + tickInterval);

    // initial call for ad slot visibility + 11 calls accounting for 1..10s + final call when refreshing the slot
    expect(performanceNowStub).to.have.callCount(1 + 11 + 1);

    expect(refreshCallback).to.have.been.calledOnceWithExactly(slot);
  });
});
