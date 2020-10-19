import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import JustPremium from './index';
import { Moli } from '@highfivve/ad-tag';
import { createMoliTag } from '@highfivve/ad-tag/source/ts/ads/moli';
import { newNoopLogger } from '@highfivve/ad-tag/tests/ts/stubs/moliStubs';
import { pbjsTestConfig } from '@highfivve/ad-tag/tests/ts/stubs/prebidjsStubs';
import { createDom } from '@highfivve/ad-tag/tests/ts/stubs/browserEnvSetup';

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('JustPremium Module', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window = dom.window as any;

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    sandbox.reset();
  });

  const createAdSlots = (window: Window, domIds: string[]): Moli.AdSlot[] => {
    return domIds.map(domId => {
      const div = window.document.createElement('div');
      div.id = domId;
      window.document.body.appendChild(div);

      const slot: Moli.AdSlot = {
        domId: domId,
        adUnitPath: domId,
        position: 'in-page',
        sizes: [],
        behaviour: { loaded: 'eager' },
        labelAll: [],
        labelAny: [],
        sizeConfig: []
      };
      return slot;
    });
  };

  it('should set the prebidResponse listener', () => {
    const moli = createMoliTag(jsDomWindow);
    const noopLogger = newNoopLogger();
    const module = new JustPremium(
      {
        wallpaperAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: ['sky-slot'],
        hideWallpaperAdSlot: false
      },
      jsDomWindow
    );

    const slots = createAdSlots(jsDomWindow, ['wp-slot', 'sky-slot']);

    const initSpy = sandbox.spy(module, 'init');
    const errorLogSpy = sandbox.spy(noopLogger, 'error');

    const config: Moli.MoliConfig = {
      slots: slots,
      logger: noopLogger,
      prebid: { config: pbjsTestConfig },
      yieldOptimization: { provider: 'none' }
    };
    moli.registerModule(module);
    moli.configure(config);

    expect(initSpy).to.have.been.calledOnce;
    expect(initSpy).to.have.been.calledWithMatch(config, moli.getAssetLoaderService());
    expect(errorLogSpy).to.have.not.been.called;

    expect(config.prebid!.listener).is.ok;
  });

  it('should fail if not all slots are available in the config', () => {
    const moli = createMoliTag(jsDomWindow);
    const noopLogger = newNoopLogger();
    const module = new JustPremium(
      {
        wallpaperAdSlotDomId: 'wp-slot',
        blockedAdSlotDomIds: ['sky-slot'],
        hideWallpaperAdSlot: false
      },
      jsDomWindow
    );

    const slots = createAdSlots(jsDomWindow, ['wp-slot']);

    const initSpy = sandbox.spy(module, 'init');
    const errorLogSpy = sandbox.spy(noopLogger, 'error');

    const config: Moli.MoliConfig = {
      slots: slots,
      logger: noopLogger,
      prebid: { config: pbjsTestConfig },
      yieldOptimization: { provider: 'none' }
    };
    moli.registerModule(module);
    moli.configure(config);

    expect(initSpy).to.have.been.calledOnce;
    expect(initSpy).to.have.been.calledWithMatch(config, moli.getAssetLoaderService());
    expect(errorLogSpy).to.have.been.called;

    expect(config.prebid!.listener).is.undefined;
  });
});

// tslint:enable
