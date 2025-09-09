import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { AdVisibilityService } from './adVisibilityService';
import { UserActivityService } from './userActivityService';
import { googletag } from 'ad-tag/types/googletag';
import ISlotVisibilityChangedEvent = googletag.events.ISlotVisibilityChangedEvent;
import { createDom } from 'ad-tag/stubs/browserEnvSetup';
import { noopLogger } from 'ad-tag/stubs/moliStubs';
import { createGoogletagStub, googleAdSlotStub } from 'ad-tag/stubs/googletagStubs';
import { modules } from 'ad-tag/types/moliConfig';
import RefreshIntervalOverrides = modules.adreload.RefreshIntervalOverrides;
import type { IntersectionObserverWindow } from 'ad-tag/types/dom';
import { MockIntersectionObserver } from 'ad-tag/stubs/dom';

use(sinonChai);

describe('AdVisibilityService', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window & IntersectionObserverWindow & googletag.IGoogleTagWindow =
    dom.window as any;
  (jsDomWindow as any).id = Math.random();
  const logger = noopLogger;

  let observer: IntersectionObserver = new MockIntersectionObserver();
  jsDomWindow.IntersectionObserver = MockIntersectionObserver;
  let intersectionObserverConstructorStub = sandbox.stub(jsDomWindow, 'IntersectionObserver');

  let observeSpy = sandbox.spy(observer, 'observe');
  let unobserveSpy = sandbox.spy(observer, 'unobserve');

  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });

  beforeEach(() => {
    jsDomWindow.googletag = createGoogletagStub();
    jsDomWindow.IntersectionObserver = MockIntersectionObserver;
    observer = new MockIntersectionObserver();
    intersectionObserverConstructorStub = sandbox.stub(jsDomWindow, 'IntersectionObserver');
    intersectionObserverConstructorStub.returns(observer);
    observeSpy = sandbox.spy(observer, 'observe');
    unobserveSpy = sandbox.spy(observer, 'unobserve');
    sandbox.useFakeTimers();
  });

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    (jsDomWindow as any).id = Math.random();
    sandbox.reset();
    sandbox.clock.restore();
  });

  const adRefreshInterval = 20000;
  const tickInterval = 1000;
  const createAdVisibilityService = (
    disableVisibilityChecks: boolean,
    overrides: RefreshIntervalOverrides = {},
    viewabilityOverrides: modules.adreload.ViewabilityOverrides = {},
    useIntersectionObserver = false
  ): AdVisibilityService => {
    const userActivityService = new UserActivityService(jsDomWindow, { level: 'strict' }, logger);

    // decouple logic from actual userActivityService
    sandbox.stub(userActivityService);

    return new AdVisibilityService(
      userActivityService,
      adRefreshInterval,
      overrides,
      useIntersectionObserver,
      disableVisibilityChecks,
      viewabilityOverrides,
      jsDomWindow,
      logger
    );
  };

  it('should setup a 1s interval to check ad visibility', () => {
    const setIntervalSpy = sandbox.spy(dom.window, 'setInterval');

    createAdVisibilityService(false);

    expect(setIntervalSpy).to.have.been.calledOnce;
    expect(setIntervalSpy).to.have.been.calledWithMatch(
      Sinon.match.func,
      AdVisibilityService.updateVisibilityInterval
    );
  });

  it('should add a pubads() event listener if useIntersectionObserver is false', () => {
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    createAdVisibilityService(false);

    expect(listenerSpy).to.have.been.calledOnce;
    expect(listenerSpy).to.have.been.calledWithMatch('slotVisibilityChanged', Sinon.match.func);
  });

  it('should track a googletag slot if the element is present in DOM', () => {
    const service = createAdVisibilityService(false);
    const slot = googleAdSlotStub('foo', 'foo');

    sandbox
      .stub(jsDomWindow.document, 'getElementById')
      .returns(jsDomWindow.document.createElement('div'));

    expect(service.isSlotTracked(slot.getSlotElementId())).to.be.false;

    service.trackSlot(slot, sandbox.stub);

    expect(service.isSlotTracked(slot.getSlotElementId())).to.be.true;
  });

  it('should not track a googletag slot if the element is NOT present in DOM', () => {
    const service = createAdVisibilityService(false);
    const slot = googleAdSlotStub('foo', 'foo');

    expect(service.isSlotTracked(slot.getSlotElementId())).to.be.false;

    service.trackSlot(slot, sandbox.stub);

    expect(service.isSlotTracked(slot.getSlotElementId())).to.be.false;
  });

  it('should remove slot tracking first if the same slot should be tracked again', () => {
    const service = createAdVisibilityService(false);
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
    const addEventListenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    // performance.now needs to be stubbed "by hand":
    // https://www.bountysource.com/issues/50501976-fake-timers-in-sinon-doesn-t-work-with-performance-now
    const performanceNowStub = sandbox.stub(jsDomWindow.performance, 'now');

    Array.from({ length: 30 }).forEach((_, index) => {
      performanceNowStub.onCall(index).returns((index + 1) * 1000);
    });

    const service = createAdVisibilityService(false);

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

    const addEventListenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    // performance.now needs to be stubbed "by hand":
    // https://www.bountysource.com/issues/50501976-fake-timers-in-sinon-doesn-t-work-with-performance-now
    const performanceNowStub = sandbox.stub(jsDomWindow.performance, 'now');

    Array.from({ length: 15 }).forEach((_, index) => {
      performanceNowStub.onCall(index).returns((index + 1) * 1000);
    });

    const service = createAdVisibilityService(false, { bar: newRefreshInterval });

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

  it('disableVisibilityChecks: should call the refreshCallback even if slot is out of viewport', () => {
    const addEventListenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    // performance.now needs to be stubbed "by hand":
    // https://www.bountysource.com/issues/50501976-fake-timers-in-sinon-doesn-t-work-with-performance-now
    const performanceNowStub = sandbox.stub(jsDomWindow.performance, 'now');

    Array.from({ length: 30 }).forEach((_, index) => {
      performanceNowStub.onCall(index).returns(index * 1000);
    });

    const service = createAdVisibilityService(true);

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

    visibilityChangedListener({ inViewPercentage: 0, slot } as ISlotVisibilityChangedEvent);

    sandbox.clock.tick(adRefreshInterval + tickInterval);

    // when setting the initial record (because of disableVisibilityChecks flag) + initial call for
    // ad slot visibility + 21 calls accounting for 1..20s + final call when refreshing the slot
    expect(performanceNowStub).to.have.callCount(1 + 1 + 21 + 1);

    expect(refreshCallback).to.have.been.calledOnceWithExactly(slot);
  });

  it('disableVisibilityChecks: should call the refreshCallback even if slot is out of viewport and NO googletag visibility event was received', () => {
    const addEventListenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    // performance.now needs to be stubbed "by hand":
    // https://www.bountysource.com/issues/50501976-fake-timers-in-sinon-doesn-t-work-with-performance-now
    const performanceNowStub = sandbox.stub(jsDomWindow.performance, 'now');

    Array.from({ length: 30 }).forEach((_, index) => {
      performanceNowStub.onCall(index).returns((index + 1) * 1000);
    });

    const service = createAdVisibilityService(true);

    const slot = googleAdSlotStub('foo', 'foo');

    expect(addEventListenerSpy).to.have.been.calledOnce;
    expect(addEventListenerSpy).to.have.been.calledWithMatch(
      'slotVisibilityChanged',
      Sinon.match.func
    );

    sandbox
      .stub(jsDomWindow.document, 'getElementById')
      .returns(jsDomWindow.document.createElement('div'));

    const refreshCallback = sandbox.stub();
    service.trackSlot(slot, refreshCallback);

    sandbox.clock.tick(adRefreshInterval + tickInterval);

    // initial call for ad slot visibility + 21 calls accounting for 1..20s + final call when refreshing the slot
    // note that no slot visibility event had to be fired.
    expect(performanceNowStub).to.have.callCount(1 + 21 + 1);

    expect(refreshCallback).to.have.been.calledOnceWithExactly(slot);
  });

  describe('ViewabilityOverrides', () => {
    const adSlotDomId = 'content-1';
    const cssSelector = '.inScreen';
    const viewabilityOverrides: modules.adreload.ViewabilityOverrides = {
      [adSlotDomId]: { variant: 'css', cssSelector }
    };

    const createAndStubAdSlot = (adSlotDomId: string) => {
      const slot = googleAdSlotStub('/123/content-1', adSlotDomId);
      const slotElement = jsDomWindow.document.createElement('div');
      return {
        slot,
        slotElement,
        getElementByIdStub: sandbox
          .stub(jsDomWindow.document, 'getElementById')
          .returns(slotElement)
      };
    };

    it('should not create an IntersectionObserver if useIntersectionObserver is false', () => {
      createAdVisibilityService(false, {}, {}, false);
      expect(intersectionObserverConstructorStub).to.not.have.been.called;
    });

    it('should create an IntersectionObserver if useIntersectionObserver is false, but overrides are provided', () => {
      createAdVisibilityService(false, {}, viewabilityOverrides, false);
      expect(intersectionObserverConstructorStub).to.have.been.calledOnce;
    });

    it('should create an IntersectionObserver if useIntersectionObserver is true', () => {
      createAdVisibilityService(false, {}, {}, true);
      expect(intersectionObserverConstructorStub).to.have.been.calledOnce;
    });

    describe('trackSlot with css variant', () => {
      it('should track a slot with an IntersectionObserver if override is defined', () => {
        const service = createAdVisibilityService(false, {}, viewabilityOverrides, false);

        const { slot, getElementByIdStub } = createAndStubAdSlot(adSlotDomId);
        const overrideElement = jsDomWindow.document.createElement('div');
        const querySelectorStub = sandbox
          .stub(jsDomWindow.document, 'querySelector')
          .returns(overrideElement);

        service.trackSlot(slot, sandbox.stub);

        expect(getElementByIdStub).to.have.been.calledOnceWithExactly(slot.getSlotElementId());
        expect(querySelectorStub).to.have.calledOnce;
        expect(querySelectorStub).to.have.been.calledOnceWithExactly(cssSelector);
        expect(observeSpy).to.have.been.calledOnceWithExactly(overrideElement);
      });
      it('should fallback to the slot element if the override element is not found and useIntersectionObserver is true', () => {
        const service = createAdVisibilityService(false, {}, viewabilityOverrides, true);

        const { slot, slotElement, getElementByIdStub } = createAndStubAdSlot(adSlotDomId);
        const querySelectorStub = sandbox.stub(jsDomWindow.document, 'querySelector').returns(null);

        service.trackSlot(slot, sandbox.stub);

        expect(getElementByIdStub).to.have.been.calledOnceWithExactly(slot.getSlotElementId());
        expect(querySelectorStub).to.have.calledOnce;
        expect(querySelectorStub).to.have.been.calledOnceWithExactly(cssSelector);
        expect(observeSpy).to.have.been.calledOnceWithExactly(slotElement);
      });

      it('should not call observe if the override element is not found and userIntersectionObserver is false', () => {
        const service = createAdVisibilityService(false, {}, viewabilityOverrides, false);
        const { slot, getElementByIdStub } = createAndStubAdSlot(adSlotDomId);
        const querySelectorStub = sandbox.stub(jsDomWindow.document, 'querySelector').returns(null);

        service.trackSlot(slot, sandbox.stub);

        expect(getElementByIdStub).to.have.been.calledOnceWithExactly(slot.getSlotElementId());
        expect(querySelectorStub).to.have.calledOnce;
        expect(querySelectorStub).to.have.been.calledOnceWithExactly(cssSelector);
        expect(observeSpy).to.not.have.been.called;
      });

      describe('removeSlotTracking', () => {
        it('should unobserve the override element if it exists', () => {
          const service = createAdVisibilityService(false, {}, viewabilityOverrides, false);
          const { slot } = createAndStubAdSlot(adSlotDomId);
          const overrideElement = jsDomWindow.document.createElement('div');
          sandbox.stub(jsDomWindow.document, 'querySelector').returns(overrideElement);

          service.trackSlot(slot, sandbox.stub);
          service.removeSlotTracking(slot);

          expect(observeSpy).to.have.been.calledOnceWithExactly(overrideElement);
          expect(unobserveSpy).to.have.been.calledOnce;
          expect(unobserveSpy).to.have.been.calledOnceWithExactly(overrideElement);
        });
      });
    });

    describe('trackSlot with disabled variant', () => {
      const adSlotDomId = 'content-1';
      const viewabilityOverrides: modules.adreload.ViewabilityOverrides = {
        [adSlotDomId]: { variant: 'disabled', disableAllAdVisibilityChecks: true }
      };

      it('should not create an IntersectionObserver if useIntersectionObserver is false', () => {
        createAdVisibilityService(false, {}, viewabilityOverrides, false);
        expect(intersectionObserverConstructorStub).to.not.have.been.called;
      });

      it('should create an IntersectionObserver if useIntersectionObserver is true', () => {
        createAdVisibilityService(false, {}, viewabilityOverrides, true);
        expect(intersectionObserverConstructorStub).to.have.been.calledOnce;
      });

      it('should not call observe if the variant is disabled', () => {
        const service = createAdVisibilityService(false, {}, viewabilityOverrides, false);
        const { slot } = createAndStubAdSlot(adSlotDomId);

        service.trackSlot(slot, sandbox.stub);

        expect(observeSpy).to.not.have.been.called;
      });

      it('disableVisibilityChecks: should call the refreshCallback even if slot is out of viewport and NO googletag visibility event was received', () => {
        const { slot } = createAndStubAdSlot(adSlotDomId);

        // performance.now needs to be stubbed "by hand":
        // https://www.bountysource.com/issues/50501976-fake-timers-in-sinon-doesn-t-work-with-performance-now
        const performanceNowStub = sandbox.stub(jsDomWindow.performance, 'now');

        Array.from({ length: 30 }).forEach((_, index) => {
          performanceNowStub.onCall(index).returns((index + 1) * 1000);
        });

        const service = createAdVisibilityService(false, {}, viewabilityOverrides, false);

        const refreshCallback = sandbox.stub();
        service.trackSlot(slot, refreshCallback);

        sandbox.clock.tick(adRefreshInterval + tickInterval);

        // initial call for ad slot visibility + 21 calls accounting for 1..20s + final call when refreshing the slot
        // note that no slot visibility event had to be fired.
        expect(performanceNowStub).to.have.callCount(1 + 21 + 1);

        expect(refreshCallback).to.have.been.calledOnceWithExactly(slot);
      });

      it('disableVisibilityChecks: should call the refreshCallback even if slot is out of viewport and NO googletag visibility event was received for specified advertiserId', () => {
        const { slot } = createAndStubAdSlot(adSlotDomId);

        // performance.now needs to be stubbed "by hand":
        // https://www.bountysource.com/issues/50501976-fake-timers-in-sinon-doesn-t-work-with-performance-now
        const performanceNowStub = sandbox.stub(jsDomWindow.performance, 'now');

        Array.from({ length: 30 }).forEach((_, index) => {
          performanceNowStub.onCall(index).returns((index + 1) * 1000);
        });

        const service = createAdVisibilityService(
          false,
          {},
          {
            [adSlotDomId]: {
              variant: 'disabled',
              disableAllAdVisibilityChecks: false,
              disabledAdVisibilityCheckAdvertiserIds: [55555]
            }
          },
          false
        );

        const refreshCallback = sandbox.stub();
        service.trackSlot(slot, refreshCallback, 55555);

        sandbox.clock.tick(adRefreshInterval + tickInterval);

        // initial call for ad slot visibility + 21 calls accounting for 1..20s + final call when refreshing the slot
        // note that no slot visibility event had to be fired.
        expect(performanceNowStub).to.have.callCount(1 + 21 + 1);

        expect(refreshCallback).to.have.been.calledOnceWithExactly(slot);
      });

      it('disableVisibilityChecks: should not call the refreshCallback even if slot is out of viewport and NO googletag visibility event was received for specified advertiserId', () => {
        const { slot } = createAndStubAdSlot(adSlotDomId);

        // performance.now needs to be stubbed "by hand":
        // https://www.bountysource.com/issues/50501976-fake-timers-in-sinon-doesn-t-work-with-performance-now
        const performanceNowStub = sandbox.stub(jsDomWindow.performance, 'now');

        Array.from({ length: 30 }).forEach((_, index) => {
          performanceNowStub.onCall(index).returns((index + 1) * 1000);
        });

        const service = createAdVisibilityService(
          false,
          {},
          {
            [adSlotDomId]: {
              variant: 'disabled',
              disableAllAdVisibilityChecks: false,
              disabledAdVisibilityCheckAdvertiserIds: [55555]
            }
          },
          false
        );

        const refreshCallback = sandbox.stub();
        service.trackSlot(slot, refreshCallback, 44444);

        sandbox.clock.tick(adRefreshInterval + tickInterval);

        // initial call for ad slot visibility + 21 calls accounting for 1..20s + final call when refreshing the slot
        // note that no slot visibility event had to be fired.
        expect(performanceNowStub).to.have.not.been.called;

        expect(refreshCallback).to.have.not.been.called;
      });
    });
  });
});
