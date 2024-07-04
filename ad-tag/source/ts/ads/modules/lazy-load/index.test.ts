import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import { LazyLoad } from '../../../ads/modules/lazy-load/index';
import sinonChai from 'sinon-chai';
import { AdSlot, MoliConfig } from '../../../types/moliConfig';
import { createDom } from '../../../stubs/browserEnvSetup';
import { createMoliTag } from '../../../ads/moli';
import { emptyRuntimeConfig, newNoopLogger } from '../../../stubs/moliStubs';
import { fullConsent } from '../../../stubs/consentStubs';
import { GlobalAuctionContext } from '../../../ads/globalAuctionContext';
import { pbjsTestConfig } from '../../../stubs/prebidjsStubs';
import { dummySchainConfig } from '../../../stubs/schainStubs';
import { AdPipelineContext } from '../../../ads/adPipeline';
import { createAssetLoaderService } from '../../../util/assetLoaderService';
const createAdSlots = (
  window: Window,
  domIds: string[],
  behaviour?: 'eager' | 'manual',
  bucket?: string
): AdSlot[] => {
  return domIds.map(domId => {
    const div = window.document.createElement('div');
    div.id = domId;
    window.document.body.appendChild(div);

    const slot: AdSlot = {
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
  const slot: AdSlot = {
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
  constructor(
    private readonly callback,
    private readonly options
  ) {}
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
  ): IntersectionObserverEntry => ({ isIntersecting, target: { id: targetId } }) as any;

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

  const mkConfig = (slots): MoliConfig => {
    return {
      slots: slots,
      buckets: {
        enabled: true,
        bucket: { lazy_bucket: { timeout: 3000 }, another_lazy_bucket: { timeout: 3000 } }
      },
      prebid: { config: pbjsTestConfig, schain: { nodes: [] } },
      schain: dummySchainConfig
    };
  };

  const domId1 = 'lazy-1';
  const domId2 = 'lazy-2';
  const infiniteSelector1 = '.ad-infinite';

  const adPipelineContext = (config: MoliConfig): AdPipelineContext => {
    return {
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: noopLogger,
      config: config,
      runtimeConfig: emptyRuntimeConfig,
      window: jsDomWindow as any,
      // no service dependencies required
      labelConfigService: null as any,
      tcData: fullConsent(),
      adUnitPathVariables: {},
      auction: new GlobalAuctionContext(jsDomWindow as any),
      assetLoaderService: createAssetLoaderService(jsDomWindow)
    };
  };

  describe('Lazy-slots', () => {
    it('Add configure pipeline step', () => {
      const module = new LazyLoad();
      const modulesConfig = {
        lazyload: {
          enabled: true,
          slots: [{ domIds: [domId1], options: {} }],
          buckets: []
        }
      };
      module.configure(modulesConfig);
      const configureSteps = module.configureSteps();

      expect(configureSteps).length(1);
      const configureStep = configureSteps[0];
      expect(configureStep?.name).to.be.eq('lazy-module-configuration');
    });

    it('Observe only domIds that are in the module config, i.e., lazy-1', () => {
      const oberserveSpy = sandbox.spy(observer, 'observe');
      const slots = createAdSlots(jsDomWindow, [domId1, domId2]);

      const module = new LazyLoad();
      const lazyConfig = {
        enabled: true,
        slots: [{ domIds: [domId1], options: {} }],
        buckets: []
      };
      const modulesConfig = {
        lazyload: lazyConfig
      };

      module.configure(modulesConfig);
      module.registerIntersectionObservers(adPipelineContext(mkConfig(slots)), lazyConfig);

      // trigger an intersection event
      const callback = getIntersectionObserverCallback(0);
      callback([createIntersectionObserverEntry(true, domId1)], observer);

      const args = oberserveSpy.firstCall.firstArg;

      expect(errorLogSpy).to.have.not.been.called;
      expect(intersectionObserverConstructorStub).to.have.been.calledOnce;
      expect(oberserveSpy).to.have.been.calledOnce;
      expect(args).to.equal(jsDomWindow.document.getElementById('lazy-1'));
    });

    it('Unobserve already observed and intersected slots, thus no ad-slot refresh again', () => {
      const oberserveSpy = sandbox.spy(observer, 'observe');
      const unOberserveSpy = sandbox.spy(observer, 'unobserve');

      const slots = createAdSlots(jsDomWindow, [domId1, domId2]);

      const module = new LazyLoad();
      const lazyConfig = {
        enabled: true,
        slots: [{ domIds: [domId1, domId2], options: {} }],
        buckets: []
      };
      const modulesConfig = {
        lazyload: lazyConfig
      };

      module.configure(modulesConfig);
      module.registerIntersectionObservers(adPipelineContext(mkConfig(slots)), lazyConfig);

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
      expect(refreshAdSlotsSpy).to.have.been.calledOnceWithExactly('lazy-1');
    });

    it('Observe only slots that have a manual behaviour', () => {
      const oberserveSpy = sandbox.spy(observer, 'observe');

      const module = new LazyLoad();
      const lazyConfig = {
        enabled: true,
        slots: [{ domIds: [domId1, domId2], options: {} }],
        buckets: []
      };
      const modulesConfig = {
        lazyload: lazyConfig
      };

      const eagerSlot = createAdSlots(jsDomWindow, [domId1], 'eager');
      const manualSlot = createAdSlots(jsDomWindow, [domId2], 'manual');

      module.configure(modulesConfig);
      module.registerIntersectionObservers(
        adPipelineContext(mkConfig([...manualSlot, ...eagerSlot])),
        lazyConfig
      );

      expect(errorLogSpy).to.have.not.been.called;
      expect(oberserveSpy).to.have.been.calledOnce;
      expect(oberserveSpy).to.have.been.calledOnceWithExactly(
        jsDomWindow.document.getElementById('lazy-2')
      );
    });

    it('Every slot should consider its own observer options', () => {
      const slots = createAdSlots(jsDomWindow, ['lazy-1', 'lazy-2']);

      const module = new LazyLoad();
      const lazyConfig = {
        enabled: true,
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
      };
      const modulesConfig = {
        lazyload: lazyConfig
      };

      module.configure(modulesConfig);
      module.registerIntersectionObservers(adPipelineContext(mkConfig(slots)), lazyConfig);

      const callback = getIntersectionObserverCallback(0);
      const options = getIntersectionObserverArgs(0);

      callback([createIntersectionObserverEntry(true, domId1)], observer);

      expect(errorLogSpy).to.have.not.been.called;
      expect(intersectionObserverConstructorStub).to.have.been.calledTwice;
      expect(options).to.eql({ root: null, threshold: 0.5, rootMargin: undefined });
    });
  });

  describe('Lazy-buckets', () => {
    const domId3 = 'lazy-3';
    const htmlElement = (id: string) => jsDomWindow.document.getElementById(id);

    it("Should not observe domId that doesn't belong to the bucket in config, i.e., lazy_3", () => {
      const oberserveSpy = sandbox.spy(observer, 'observe');
      const slots = createAdSlots(jsDomWindow, [domId1, domId2], 'manual', 'lazy_bucket');

      const module = new LazyLoad();
      const lazyConfig = {
        enabled: true,
        slots: [],
        buckets: [{ bucket: 'lazy_bucket', observedDomId: domId3, options: {} }]
      };
      const modulesConfig = {
        lazyload: lazyConfig
      };

      module.configure(modulesConfig);
      module.registerIntersectionObservers(adPipelineContext(mkConfig(slots)), lazyConfig);

      // trigger an intersection event
      const callback = getIntersectionObserverCallback(0);
      callback([createIntersectionObserverEntry(true, domId3)], observer);

      expect(errorLogSpy).to.have.not.been.called;
      expect(intersectionObserverConstructorStub).to.have.been.calledOnce;

      expect(oberserveSpy).to.have.not.been.called;
    });

    it('Should observe multiple buckets and refresh buckets as expected', () => {
      const domId4 = 'lazy-4-in-another-bucket';

      const observerSpy = sandbox.spy(observer, 'observe');
      const unObserverSpy = sandbox.spy(observer, 'unobserve');

      const slots = [
        ...createAdSlots(jsDomWindow, [domId1, domId2, domId3], 'manual', 'lazy_bucket'),
        ...createAdSlots(jsDomWindow, [domId4], 'manual', 'another_lazy_bucket')
      ];

      const module = new LazyLoad();
      const lazyConfig = {
        enabled: true,
        slots: [],
        buckets: [
          { bucket: 'lazy_bucket', observedDomId: domId3, options: {} },
          { bucket: 'another_lazy_bucket', observedDomId: domId4, options: {} }
        ]
      };
      const modulesConfig = {
        lazyload: lazyConfig
      };

      module.configure(modulesConfig);
      module.registerIntersectionObservers(adPipelineContext(mkConfig(slots)), lazyConfig);

      // trigger an intersection event
      const callback = getIntersectionObserverCallback(0);
      const callback2 = getIntersectionObserverCallback(1);

      callback([createIntersectionObserverEntry(true, domId3)], observer);
      callback2([createIntersectionObserverEntry(true, domId4)], observer);

      expect(errorLogSpy).to.have.not.been.called;
      expect(intersectionObserverConstructorStub).to.have.been.calledTwice;

      expect(observerSpy).callCount(2);
      expect(observerSpy.firstCall).calledWithExactly(htmlElement(domId3));
      expect(observerSpy.secondCall).calledWithExactly(htmlElement(domId4));

      expect(unObserverSpy).to.have.been.calledTwice;
      expect(unObserverSpy.firstCall).to.have.been.calledWith({ id: 'lazy-3' });
      expect(unObserverSpy.secondCall).to.have.been.calledWith({
        id: 'lazy-4-in-another-bucket'
      });

      expect(refreshBucketSpy).to.have.been.calledTwice;
      expect(refreshBucketSpy.firstCall).to.have.been.calledWith('lazy_bucket');
      expect(refreshBucketSpy.secondCall).to.have.been.calledWith('another_lazy_bucket');
    });
  });

  describe('Infinite ad slots', () => {
    it('Observe only infinite ad slots that have the correct className which identifies them as such infinite slots, i.e. ad-infinite', () => {
      const observerSpy = sandbox.spy(observer, 'observe');
      const slots = createAdSlots(jsDomWindow, [domId1, domId2]);
      const infiniteSlot = createInfiniteAdSlotinConfig(infiniteSelector1);
      createInfiniteAdSlotInDOM(jsDomWindow, infiniteSelector1, 1);
      createInfiniteAdSlotInDOM(jsDomWindow, infiniteSelector1, 2);

      const module = new LazyLoad();
      const lazyConfig = {
        enabled: true,
        slots: [{ domIds: [], options: {} }],
        buckets: [],
        infiniteSlots: [{ selector: infiniteSelector1, options: {} }]
      };
      const modulesConfig = {
        lazyload: lazyConfig
      };

      module.configure(modulesConfig);
      module.registerIntersectionObservers(
        adPipelineContext(mkConfig([...slots, infiniteSlot])),
        lazyConfig
      );

      // trigger an intersection event
      const callback = getIntersectionObserverCallback(0);
      callback([createIntersectionObserverEntry(true, 'infinite-loading-adSlot-1')], observer);
      callback([createIntersectionObserverEntry(true, 'infinite-loading-adSlot-2')], observer);

      const argsCall1 = observerSpy.firstCall.firstArg;
      const argsCall2 = observerSpy.secondCall.firstArg;

      const infiniteSlotsInDom = jsDomWindow.document.querySelectorAll(infiniteSelector1);

      expect(errorLogSpy).to.have.not.been.called;
      expect(intersectionObserverConstructorStub).to.have.been.calledTwice;
      expect(observerSpy).to.have.been.calledTwice;
      expect(argsCall1).to.equal(infiniteSlotsInDom[0]);
      expect(argsCall2).to.equal(infiniteSlotsInDom[1]);
    });
  });
});
