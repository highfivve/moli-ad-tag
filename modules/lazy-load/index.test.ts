import { newNoopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { createMoliTag, Moli } from '@highfivve/ad-tag';
import { pbjsTestConfig } from '@highfivve/ad-tag/lib/stubs/prebidjsStubs';
import { dummySchainConfig } from '@highfivve/ad-tag/lib/stubs/schainStubs';
import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import { LazyLoad } from './index';
import sinonChai from 'sinon-chai';

const createAdSlots = (
  window: Window,
  domIds: string[],
  behaviour?: 'eager' | 'manual'
): Moli.AdSlot[] => {
  return domIds.map(domId => {
    const div = window.document.createElement('div');
    div.id = domId;
    window.document.body.appendChild(div);

    const slot: Moli.AdSlot = {
      domId: domId,
      adUnitPath: domId,
      position: 'in-page',
      sizes: [],
      behaviour: { loaded: behaviour ?? 'manual' },
      labelAll: [],
      labelAny: [],
      sizeConfig: []
    };
    return slot;
  });
};

// Caution: although the infinite scrolling module is able to handle different selectors, the test infinite slots do always use a class as identifier
const createInfiniteAdSlotInDOM = (
  window: Window,
  infiniteSlotClassSelector: string,
  serialNumber: number
): void => {
  const div = window.document.createElement('div');
  div.id = `infinite-loading-adslot-${serialNumber}`;
  // Selector without the '.' at the beginning
  div.className = infiniteSlotClassSelector.slice(1);
  window.document.body.appendChild(div);
};

const createInfiniteAdSlotinConfig = (infiniteSlotClassSelector: string) => {
  const slot: Moli.AdSlot = {
    domId: 'infinite-loading-adslot',
    adUnitPath: 'infinite-loading-adslot',
    position: 'in-page',
    sizes: [],
    behaviour: { loaded: 'infinite', selector: infiniteSlotClassSelector },
    labelAll: [],
    labelAny: [],
    sizeConfig: []
  };
  return slot;
};

const MockIntersectionObserver = class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '0';
  readonly thresholds: ReadonlyArray<number> = [];
  constructor(private readonly callback, private readonly options) {}
  observe() {
    return;
  }
  unobserve() {
    return;
  }

  disconnect(): void {
    return;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
};

use(sinonChai);

describe('Lazy-load Module', () => {
  let sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow = dom.window as any;

  const domId1 = 'lazy-1';
  const domId2 = 'lazy-2';
  const infiniteSelector1 = '.ad-infinite';

  jsDomWindow.moli = createMoliTag(jsDomWindow);
  jsDomWindow.IntersectionObserver = MockIntersectionObserver;
  const noopLogger = newNoopLogger();
  const errorLogSpy = sandbox.spy(noopLogger, 'error');
  let refreshAdSlotSpy = sandbox.spy(jsDomWindow.moli, 'refreshAdSlot');
  let observer: IntersectionObserver = new MockIntersectionObserver(() => {
    return;
  }, {});
  let intersectionObserverConstructorStub = sandbox.stub(jsDomWindow, 'IntersectionObserver');

  const getIntersectionObserverCallback = (call: number): IntersectionObserverCallback => {
    return intersectionObserverConstructorStub.getCall(call).firstArg;
  };

  const getIntersectionObserverArgs = (call: number): IntersectionObserverInit => {
    return intersectionObserverConstructorStub.getCall(call).args[1] as any;
  };

  /*
   * mocks only the relevant parts of the observer entry
   */
  const createIntersectionObserverEntry = (
    isIntersecting: boolean,
    targetId: string
  ): IntersectionObserverEntry => ({ isIntersecting, target: { id: targetId } } as any);

  beforeEach(() => {
    sandbox = Sinon.createSandbox();
    dom = createDom();
    jsDomWindow = dom.window;
    jsDomWindow.moli = createMoliTag(jsDomWindow);
    jsDomWindow.IntersectionObserver = MockIntersectionObserver;
    refreshAdSlotSpy = sandbox.spy(jsDomWindow.moli, 'refreshAdSlot');
    observer = new MockIntersectionObserver(() => {
      return;
    }, {});
    intersectionObserverConstructorStub = sandbox.stub(jsDomWindow, 'IntersectionObserver');
    intersectionObserverConstructorStub.returns(observer);
  });

  afterEach(() => {
    intersectionObserverConstructorStub.reset();
    sandbox.restore();
  });

  const mkConfig = (slots): Moli.MoliConfig => {
    return {
      slots: slots,
      logger: noopLogger,
      prebid: { config: pbjsTestConfig, schain: { nodes: [] } },
      schain: dummySchainConfig
    };
  };

  it('Add init pipeline step', () => {
    const module = new LazyLoad({ slots: [], buckets: [] }, jsDomWindow);
    const config = mkConfig([]);
    module.init(config);

    expect(config.pipeline).to.be.ok;
    expect(config.pipeline?.initSteps).length(1);
    const initStep = config.pipeline?.initSteps[0];
    expect(initStep?.name).to.be.eq('moli-lazy-load');
  });

  it('Observe only domIds that are in the module config for manual slots, i.e., lazy-1', () => {
    const oberserveSpy = sandbox.spy(observer, 'observe');
    const slots = createAdSlots(jsDomWindow, [domId1, domId2]);

    const module = new LazyLoad(
      {
        slots: [{ domIds: [domId1], options: {} }],
        buckets: []
      },
      jsDomWindow
    );

    module.registerIntersectionObservers(mkConfig(slots));

    // trigger an intersection event
    const callback = getIntersectionObserverCallback(0);
    callback([createIntersectionObserverEntry(true, domId1)], observer);

    const args = oberserveSpy.firstCall.firstArg;

    expect(errorLogSpy).to.have.not.been.called;
    expect(intersectionObserverConstructorStub).to.have.been.calledOnce;
    expect(oberserveSpy).to.have.been.calledOnce;
    expect(args).to.equal(jsDomWindow.document.getElementById('lazy-1'));
  });

  it('Observe only infinite ad slots that have the correct className which identifies them as such infinite slots, i.e. ad-infinite', () => {
    const oberserveSpy = sandbox.spy(observer, 'observe');
    const slots = createAdSlots(jsDomWindow, [domId1, domId2]);
    const infiniteSlot = createInfiniteAdSlotinConfig(infiniteSelector1);
    createInfiniteAdSlotInDOM(jsDomWindow, infiniteSelector1, 1);
    createInfiniteAdSlotInDOM(jsDomWindow, infiniteSelector1, 2);

    const module = new LazyLoad(
      {
        slots: [{ domIds: [], options: {} }],
        buckets: [],
        infiniteSlots: [{ selector: infiniteSelector1, options: {} }]
      },
      jsDomWindow
    );

    module.registerIntersectionObservers(mkConfig([...slots, infiniteSlot]));

    // trigger an intersection event
    const callback = getIntersectionObserverCallback(0);
    callback([createIntersectionObserverEntry(true, 'infinite-loading-adSlot-1')], observer);
    callback([createIntersectionObserverEntry(true, 'infinite-loading-adSlot-2')], observer);

    const argsCall1 = oberserveSpy.firstCall.firstArg;
    const argsCall2 = oberserveSpy.secondCall.firstArg;

    const infiniteSlotsInDom = jsDomWindow.document.querySelectorAll(infiniteSelector1);

    expect(errorLogSpy).to.have.not.been.called;
    expect(intersectionObserverConstructorStub).to.have.been.calledTwice;
    expect(oberserveSpy).to.have.been.calledTwice;
    expect(argsCall1).to.equal(infiniteSlotsInDom[0]);
    expect(argsCall2).to.equal(infiniteSlotsInDom[1]);
  });

  it('Unobserve already observed and intersected slots, thus no ad-slot refresh again', () => {
    const oberserveSpy = sandbox.spy(observer, 'observe');
    const unOberserveSpy = sandbox.spy(observer, 'unobserve');

    const slots = createAdSlots(jsDomWindow, [domId1, domId2]);

    const module = new LazyLoad(
      {
        slots: [{ domIds: [domId1, domId2], options: {} }],
        buckets: []
      },
      jsDomWindow
    );

    module.registerIntersectionObservers(mkConfig(slots));

    const callback = getIntersectionObserverCallback(0);

    const intersected = createIntersectionObserverEntry(true, domId1);
    const unIntersected = createIntersectionObserverEntry(false, domId2);

    callback([intersected, unIntersected], observer);
    const firstCallArgs = unOberserveSpy.firstCall.args;

    expect(errorLogSpy).to.have.not.been.called;
    expect(oberserveSpy).to.have.been.calledTwice;
    expect(unOberserveSpy).to.have.been.calledOnce;
    expect(unOberserveSpy).to.have.been.calledOnceWithExactly({ id: 'lazy-1' });
    expect(firstCallArgs).to.deep.contain({ id: 'lazy-1' });
    expect(refreshAdSlotSpy).to.have.been.calledOnceWithExactly('lazy-1');
  });

  it('Observe only slots that have a manual or infinite behaviour', () => {
    const observeSpy = sandbox.spy(observer, 'observe');
    const manualSlot = createAdSlots(jsDomWindow, [domId1], 'manual');
    const eagerSlot = createAdSlots(jsDomWindow, [domId2], 'eager');
    const infiniteSlot = createInfiniteAdSlotinConfig(infiniteSelector1);
    createInfiniteAdSlotInDOM(jsDomWindow, infiniteSelector1, 1);

    const module = new LazyLoad(
      {
        slots: [{ domIds: [domId1, domId2], options: {} }],
        buckets: [],
        infiniteSlots: [{ selector: infiniteSelector1, options: {} }]
      },
      jsDomWindow
    );

    module.registerIntersectionObservers(mkConfig([...manualSlot, ...eagerSlot, infiniteSlot]));

    expect(errorLogSpy).to.have.not.been.called;
    expect(observeSpy).to.have.been.calledWith(jsDomWindow.document.querySelector(`#${domId1}`));
    expect(observeSpy).to.have.been.calledWith(
      jsDomWindow.document.querySelector(infiniteSelector1)
    );
    expect(observeSpy).to.have.not.been.calledWith(
      jsDomWindow.document.querySelector(`#${domId2}`)
    );
  });

  it('Every slot should consider its own observer options', () => {
    const slots = createAdSlots(jsDomWindow, ['lazy-1', 'lazy-2']);

    const module = new LazyLoad(
      {
        slots: [
          {
            domIds: [domId1],
            options: { threshold: 0.5, rootMargin: undefined }
          },
          {
            domIds: [domId2],
            options: { rootId: 'bla' }
          }
        ],
        buckets: []
      },
      jsDomWindow
    );

    module.registerIntersectionObservers(mkConfig(slots));

    const callback = getIntersectionObserverCallback(0);
    const options = getIntersectionObserverArgs(0);

    callback([createIntersectionObserverEntry(true, domId1)], observer);

    expect(errorLogSpy).to.have.not.been.called;
    expect(intersectionObserverConstructorStub).to.have.been.calledTwice;
    expect(options).to.eql({ root: null, threshold: 0.5, rootMargin: undefined });
  });
});
