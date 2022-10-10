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
  behaviour?: 'eager' | 'manual',
  bucket?: string
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
      behaviour: { loaded: behaviour ?? 'manual', bucket: bucket },
      labelAll: [],
      labelAny: [],
      sizeConfig: []
    };
    return slot;
  });
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
  jsDomWindow.moli = createMoliTag(jsDomWindow);
  jsDomWindow.IntersectionObserver = MockIntersectionObserver;
  const noopLogger = newNoopLogger();
  const errorLogSpy = sandbox.spy(noopLogger, 'error');
  let refreshAdSlotsSpy = sandbox.spy(jsDomWindow.moli, 'refreshAdSlot');
  let refreshBucketSpy = sandbox.spy(jsDomWindow.moli, 'refreshBucket');
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
    refreshAdSlotsSpy = sandbox.spy(jsDomWindow.moli, 'refreshAdSlot');
    refreshBucketSpy = sandbox.spy(jsDomWindow.moli, 'refreshBucket');

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

  const config = (slots): Moli.MoliConfig => {
    return {
      slots: slots,
      buckets: {
        enabled: true,
        bucket: { lazy_bucket: { timeout: 3000 }, another_lazy_bucket: { timeout: 3000 } }
      },
      logger: noopLogger,
      prebid: { config: pbjsTestConfig, schain: { nodes: [] } },
      schain: dummySchainConfig
    };
  };
  const domId1 = 'lazy-1';
  const domId2 = 'lazy-2';
  describe('Lazy-slots', () => {
    it('Observe only domIds that are in the module config, i.e., lazy-1', () => {
      const oberserveSpy = sandbox.spy(observer, 'observe');
      const slots = createAdSlots(jsDomWindow, [domId1, domId2]);

      const module = new LazyLoad(
        {
          slots: [{ domIds: [domId1], options: {} }],
          buckets: []
        },
        jsDomWindow
      );

      const initSpy = sandbox.spy(module, 'init');
      module.init(config(slots));

      // trigger an intersection event
      const callback = getIntersectionObserverCallback(0);
      callback([createIntersectionObserverEntry(true, domId1)], observer);

      const args = oberserveSpy.firstCall.firstArg;

      expect(errorLogSpy).to.have.not.been.called;
      expect(initSpy).to.have.been.calledOnce;
      expect(intersectionObserverConstructorStub).to.have.been.calledOnce;
      expect(oberserveSpy).to.have.been.calledOnce;
      expect(args).to.equal(jsDomWindow.document.getElementById('lazy-1'));
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

      const initSpy = sandbox.spy(module, 'init');
      module.init(config(slots));

      const callback = getIntersectionObserverCallback(0);

      const intersected = createIntersectionObserverEntry(true, domId1);
      const unIntersected = createIntersectionObserverEntry(false, domId2);

      callback([intersected, unIntersected], observer);
      const firstCallArgs = unOberserveSpy.firstCall.args;

      expect(errorLogSpy).to.have.not.been.called;
      expect(initSpy).to.have.been.calledOnce;
      expect(oberserveSpy).to.have.been.calledTwice;
      expect(unOberserveSpy).to.have.been.calledOnce;
      expect(unOberserveSpy).to.have.been.calledOnceWithExactly({ id: 'lazy-1' });
      expect(firstCallArgs).to.deep.contain({ id: 'lazy-1' });
      expect(refreshAdSlotsSpy).to.have.been.calledOnceWithExactly('lazy-1');
    });

    it('Observe only slots that have a manual behaviour', () => {
      const oberserveSpy = sandbox.spy(observer, 'observe');
      const eagerSlot = createAdSlots(jsDomWindow, [domId1], 'manual');
      const manualSlot = createAdSlots(jsDomWindow, [domId2], 'eager');

      const module = new LazyLoad(
        {
          slots: [{ domIds: [domId1, domId2], options: {} }],
          buckets: []
        },
        jsDomWindow
      );

      const initSpy = sandbox.spy(module, 'init');
      module.init(config([...manualSlot, ...eagerSlot]));

      expect(errorLogSpy).to.have.not.been.called;
      expect(initSpy).to.have.been.calledOnce;
      expect(oberserveSpy).to.have.been.calledOnceWithExactly(
        jsDomWindow.document.getElementById('lazy-1')
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

      const initSpy = sandbox.spy(module, 'init');
      module.init(config(slots));

      const callback = getIntersectionObserverCallback(0);
      const options = getIntersectionObserverArgs(0);

      callback([createIntersectionObserverEntry(true, domId1)], observer);

      expect(errorLogSpy).to.have.not.been.called;
      expect(initSpy).to.have.been.calledOnce;
      expect(intersectionObserverConstructorStub).to.have.been.calledTwice;
      expect(options).to.eql({ root: null, threshold: 0.5, rootMargin: undefined });
    });
  });

  describe('Lazy-buckets', () => {
    const domId3 = 'lazy-3';
    const htmlElement = (id: string) => jsDomWindow.document.getElementById(id);

    it('Observe all slots in corresponding bucket that is in the module config, i.e., lazy_bucket', () => {
      const oberserveSpy = sandbox.spy(observer, 'observe');
      const slots = createAdSlots(jsDomWindow, [domId1, domId2, domId3], 'manual', 'lazy_bucket');

      const module = new LazyLoad(
        {
          slots: [],
          buckets: [{ buckets: ['lazy_bucket'], options: {} }]
        },
        jsDomWindow
      );

      const initSpy = sandbox.spy(module, 'init');
      module.init(config(slots));

      // trigger an intersection event
      const callback = getIntersectionObserverCallback(0);
      callback([createIntersectionObserverEntry(true, domId2)], observer);

      expect(errorLogSpy).to.have.not.been.called;
      expect(initSpy).to.have.been.calledOnce;
      expect(intersectionObserverConstructorStub).to.have.been.calledOnce;
      expect(oberserveSpy).to.have.been.calledThrice;
      expect(oberserveSpy.firstCall).calledWithExactly(htmlElement(domId1));
      expect(oberserveSpy.secondCall).calledWithExactly(htmlElement(domId2));
      expect(oberserveSpy.thirdCall).calledWithExactly(htmlElement(domId3));
      expect(refreshBucketSpy).to.have.been.calledOnce;
    });

    it('Unobserve already observed and intersected slots, and all the slots that belong to the same bucket', () => {
      const oberserveSpy = sandbox.spy(observer, 'observe');
      const unOberserveSpy = sandbox.spy(observer, 'unobserve');

      const slots = createAdSlots(jsDomWindow, [domId1, domId2, domId3], 'manual', 'lazy_bucket');

      const module = new LazyLoad(
        {
          slots: [],
          buckets: [{ buckets: ['lazy_bucket'], options: {} }]
        },
        jsDomWindow
      );

      const initSpy = sandbox.spy(module, 'init');
      module.init(config(slots));

      const callback = getIntersectionObserverCallback(0);

      const intersected = createIntersectionObserverEntry(true, domId1);
      const unIntersected = createIntersectionObserverEntry(false, domId2);
      const unIntersected2 = createIntersectionObserverEntry(false, domId3);

      callback([intersected, unIntersected, unIntersected2], observer);

      expect(errorLogSpy).to.have.not.been.called;
      expect(initSpy).to.have.been.calledOnce;
      expect(oberserveSpy).to.have.been.calledThrice;
      expect(unOberserveSpy).to.have.been.calledThrice;
      expect(unOberserveSpy.firstCall).calledWithExactly(htmlElement(domId1));
      expect(unOberserveSpy.secondCall).calledWithExactly(htmlElement(domId2));
      expect(unOberserveSpy.thirdCall).calledWithExactly(htmlElement(domId3));
      expect(refreshBucketSpy).to.have.been.calledOnce;
    });

    it('Should observe multiple buckets and refresh buckets as expected', () => {
      const domId4 = 'lazy-4-in-another-bucket';

      const oberserveSpy = sandbox.spy(observer, 'observe');
      const slots = [
        ...createAdSlots(jsDomWindow, [domId1, domId2, domId3], 'manual', 'lazy_bucket'),
        ...createAdSlots(jsDomWindow, [domId4], 'manual', 'another_lazy_bucket')
      ];

      const module = new LazyLoad(
        {
          slots: [],
          buckets: [
            { buckets: ['lazy_bucket'], options: {} },
            { buckets: ['another_lazy_bucket'], options: {} }
          ]
        },
        jsDomWindow
      );

      const initSpy = sandbox.spy(module, 'init');
      module.init(config(slots));

      // trigger an intersection event
      const callback = getIntersectionObserverCallback(0);
      callback([createIntersectionObserverEntry(true, domId1)], observer);
      callback([createIntersectionObserverEntry(true, domId4)], observer);

      expect(errorLogSpy).to.have.not.been.called;
      expect(initSpy).to.have.been.calledOnce;
      expect(intersectionObserverConstructorStub).to.have.been.calledTwice;
      expect(oberserveSpy).callCount(4);
      expect(oberserveSpy.firstCall).calledWithExactly(htmlElement(domId1));
      expect(oberserveSpy.secondCall).calledWithExactly(htmlElement(domId2));
      expect(oberserveSpy.thirdCall).calledWithExactly(htmlElement(domId3));
      expect(oberserveSpy.lastCall.calledWithExactly(htmlElement(domId4)));

      expect(refreshBucketSpy).to.have.been.calledTwice;
    });
  });
});
