import { newNoopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { createMoliTag, Moli } from '@highfivve/ad-tag';
import { pbjsTestConfig } from '@highfivve/ad-tag/lib/stubs/prebidjsStubs';
import { dummySchainConfig } from '@highfivve/ad-tag/lib/stubs/schainStubs';
import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import { LazyLoad } from './index';
import sinonChai from 'sinon-chai';

const createAdSlots = (window: Window, domIds: string[]): Moli.AdSlot[] => {
  return domIds.map(domId => {
    const div = window.document.createElement('div');
    div.id = domId;
    window.document.body.appendChild(div);

    const slot: Moli.AdSlot = {
      domId: domId,
      adUnitPath: domId,
      position: 'in-page',
      sizes: [[300, 300]],
      behaviour: { loaded: 'manual' },
      labelAll: [],
      labelAny: [],
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [[300, 300]]
        }
      ]
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

  disconnect() {
    return;
  }
};

use(sinonChai);

describe('Lazy-load Module', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow = dom.window as any;

  jsDomWindow.moli = createMoliTag(jsDomWindow);
  let refreshAdSlotsStub = sandbox.stub(jsDomWindow.moli, 'refreshAdSlot');

  beforeEach(() => {
    sandbox.restore();
    dom = createDom();
    jsDomWindow = dom.window;
    jsDomWindow.IntersectionObserver = MockIntersectionObserver;
    jsDomWindow.moli = createMoliTag(jsDomWindow);
  });

  it('Refreshes adSlot when it is intersected', () => {

    const intersectionObserverConstructorSpy = sandbox.spy(jsDomWindow, 'IntersectionObserver');

    const noopLogger = newNoopLogger();
    const module = new LazyLoad(
      {
        slots: [
          {
            domIds: ['lazy-loading-adslot-1', 'lazy-loading-adslot-2'],
            options: { threshold: 0.5 }
          },
          {
            domIds: ['lazy-loading-adslot-3'],
            options: { threshold: 0.2, rootMargin: '10px' }
          }
        ],
        buckets: []
      },
      jsDomWindow
    );

    const moliSlot = {
      domId: 'lazy-loading-adslot-1',
      sizes: [[300, 600]],
      behaviour: { loaded: 'manual' }
    } as Moli.AdSlot;
    const slots = createAdSlots(jsDomWindow, [
      'lazy-loading-adslot-1',
      'lazy-loading-adslot-2',
      'lazy-loading-adslot-3'
    ]);

    const config: Moli.MoliConfig = {
      slots: slots,
      logger: noopLogger,
      prebid: { config: pbjsTestConfig, schain: { nodes: [] } },
      schain: dummySchainConfig
    };

    const initSpy = sandbox.spy(module, 'init');
    const errorLogSpy = sandbox.spy(noopLogger, 'error');

    // expect(dom.window.document.getElementById('lazy-loading-adslot-2')).not.to.be.ok;
    module.init(config);
    expect(initSpy).to.have.been.called;
    expect(errorLogSpy).to.have.not.been.called;
    expect(intersectionObserverConstructorSpy).to.have.been.calledTwice;

    const [callback, options] = intersectionObserverConstructorSpy.firstCall.args;
    expect(options).to.eql({ root: null, threshold: 0.5, rootMargin: undefined });
    const [callback2, options2] = intersectionObserverConstructorSpy.secondCall.args;
    expect(options2).to.eql({ root: null, threshold: 0.2, rootMargin: '10px' });

    // this is the scrolling thing!!
    callback([]);

    expect(refreshAdSlotsStub).to.have.not.been.called;
  });
});
