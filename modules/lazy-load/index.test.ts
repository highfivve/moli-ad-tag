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

const MockIntersectionObserver = class {
  constructor(private readonly callback, private readonly options) {}
  observe() {
    return;
  }
  unobserve() {
    return;
  }
};

use(sinonChai);

describe('Lazy-load Module', () => {
  let sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow = dom.window as any;

  jsDomWindow.moli = createMoliTag(jsDomWindow);
  let noopLogger = newNoopLogger();
  let errorLogSpy = sandbox.spy(noopLogger, 'error');
  let refreshAdSlotsSpy = sandbox.spy(jsDomWindow.moli, 'refreshAdSlot');
  let callbackSpy = sandbox.spy();

  beforeEach(() => {
    sandbox = Sinon.createSandbox();
    dom = createDom();
    jsDomWindow = dom.window;
    jsDomWindow.IntersectionObserver = MockIntersectionObserver;
    jsDomWindow.moli = createMoliTag(jsDomWindow);
    noopLogger = newNoopLogger();
    errorLogSpy = sandbox.spy(noopLogger, 'error');
    refreshAdSlotsSpy = sandbox.spy(jsDomWindow.moli, 'refreshAdSlot');
    callbackSpy = sandbox.spy();
  });

  afterEach(() => {
    sandbox.restore();
  });

  const config = (slots): Moli.MoliConfig => {
    return {
      slots: slots,
      logger: noopLogger,
      prebid: { config: pbjsTestConfig, schain: { nodes: [] } },
      schain: dummySchainConfig
    };
  };

  it('Observe only domIds that are in the module config, i.e., lazy-1', () => {
    const observer = new MockIntersectionObserver(callbackSpy, {});
    const oberserveSpy = sandbox.spy(observer, 'observe');

    const intersectionObserverConstructorStub = sandbox.stub(jsDomWindow, 'IntersectionObserver');
    intersectionObserverConstructorStub.returns(observer);

    const slots = createAdSlots(jsDomWindow, ['lazy-1', 'lazy-2']);

    const module = new LazyLoad(
      {
        slots: [
          {
            domIds: ['lazy-1'],
            options: {}
          }
        ],
        buckets: []
      },
      jsDomWindow
    );

    const initSpy = sandbox.spy(module, 'init');
    module.init(config(slots));

    const intersectionObserverEntry1 = {
      isIntersecting: true,
      target: {
        id: 'lazy-1'
      }
    };

    callbackSpy([intersectionObserverEntry1]);
    const args = oberserveSpy.firstCall.firstArg;

    expect(errorLogSpy).to.have.not.been.called;
    expect(initSpy).to.have.been.calledOnce;
    expect(intersectionObserverConstructorStub).to.have.been.calledOnce;
    expect(callbackSpy).to.have.been.calledOnce;
    expect(oberserveSpy).to.have.been.calledOnce;
    expect(args).to.equal(jsDomWindow.document.getElementById('lazy-1'));
  });

  it('Unobserve already observed and intersected slots, thus no ad-slot refresh again', () => {
    const observer = new MockIntersectionObserver(callbackSpy, {});
    const intersectionObserverConstructorStub = sandbox.stub(jsDomWindow, 'IntersectionObserver');
    intersectionObserverConstructorStub.returns(observer);
    const oberserveSpy = sandbox.spy(observer, 'observe');
    const unOberserveSpy = sandbox.spy(observer, 'unobserve');

    const slots = createAdSlots(jsDomWindow, ['lazy-1', 'lazy-2']);

    const module = new LazyLoad(
      {
        slots: [
          {
            domIds: ['lazy-1', 'lazy-2'],
            options: {}
          }
        ],
        buckets: []
      },
      jsDomWindow
    );

    const initSpy = sandbox.spy(module, 'init');
    module.init(config(slots));

    const callback = intersectionObserverConstructorStub.firstCall.firstArg;

    const intersected = {
      isIntersecting: true,
      target: {
        id: 'lazy-1'
      }
    };

    const unIntersected = {
      isIntersecting: false,
      target: {
        id: 'lazy-2'
      }
    };

    callbackSpy.call([intersected, unIntersected]);
    callback([intersected, unIntersected]);

    const firstCallArgs = unOberserveSpy.getCall(0).args;

    expect(errorLogSpy).to.have.not.been.called;
    expect(initSpy).to.have.been.calledOnce;
    expect(callbackSpy).to.have.been.calledOnce;
    expect(oberserveSpy).to.have.been.calledTwice;
    expect(unOberserveSpy).to.have.been.calledOnceWithExactly({ id: 'lazy-1' });
    expect(firstCallArgs).to.deep.contain({ id: 'lazy-1' });
    expect(refreshAdSlotsSpy).to.have.been.calledOnceWithExactly('lazy-1');
  });

  it('Observe only slots that have a manual behaviour', () => {
    const observer = new MockIntersectionObserver(callbackSpy, {});
    const intersectionObserverConstructorStub = sandbox.stub(jsDomWindow, 'IntersectionObserver');
    intersectionObserverConstructorStub.returns(observer);
    const oberserveSpy = sandbox.spy(observer, 'observe');

    const eagerSlot = createAdSlots(jsDomWindow, ['lazy-1'], 'manual');
    const manualSlot = createAdSlots(jsDomWindow, ['lazy-2'], 'eager');

    const module = new LazyLoad(
      {
        slots: [
          {
            domIds: ['lazy-1', 'lazy-2'],
            options: {}
          }
        ],
        buckets: []
      },
      jsDomWindow
    );

    const initSpy = sandbox.spy(module, 'init');
    module.init(config([...manualSlot, ...eagerSlot]));

    const entry1 = {
      target: {
        id: 'lazy-1'
      }
    };

    const entry2 = {
      target: {
        id: 'lazy-2'
      }
    };

    callbackSpy.call([entry1, entry2]);

    expect(errorLogSpy).to.have.not.been.called;
    expect(initSpy).to.have.been.calledOnce;
    expect(callbackSpy).to.have.been.calledOnce;
    expect(oberserveSpy).to.have.been.calledOnceWithExactly(
      jsDomWindow.document.getElementById('lazy-1')
    );
  });

  it('Every slot should consider its own observer options', () => {
    const observer = new MockIntersectionObserver(callbackSpy, {});
    const intersectionObserverConstructorStub = sandbox.stub(jsDomWindow, 'IntersectionObserver');
    intersectionObserverConstructorStub.returns(observer);

    const slots = createAdSlots(jsDomWindow, ['lazy-1', 'lazy-2']);

    const module = new LazyLoad(
      {
        slots: [
          {
            domIds: ['lazy-1'],
            options: { threshold: 0.5, rootMargin: undefined }
          },
          {
            domIds: ['lazy-2'],
            options: { rootId: 'bla' }
          }
        ],
        buckets: []
      },
      jsDomWindow
    );

    const initSpy = sandbox.spy(module, 'init');
    module.init(config(slots));

    const [callback, options] = intersectionObserverConstructorStub.firstCall.args;

    const intersected = {
      isIntersecting: true,
      target: {
        id: 'lazy-1'
      }
    };

    callbackSpy.call([intersected]);
    callback([intersected]);

    expect(errorLogSpy).to.have.not.been.called;
    expect(initSpy).to.have.been.calledOnce;
    expect(callbackSpy).to.have.been.calledOnce;
    expect(intersectionObserverConstructorStub).to.have.been.calledTwice;
    expect(options).to.eql({ root: null, threshold: 0.5, rootMargin: undefined });
  });
});
