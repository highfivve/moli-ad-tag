import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { createDom } from '../stubs/browserEnvSetup';
import { createGoogletagStub } from '../stubs/googletagStubs';
import { pbjsStub } from '../stubs/prebidjsStubs';
import { tcData, tcfapiFunction } from '../stubs/consentStubs';
import { initAdTag } from '../ads/moliGlobal';
import { emptyConfig } from '../stubs/moliStubs';
import { MoliRuntime } from '../types/moliRuntime';
import { googletag } from '../types/googletag';
import { prebidjs } from '../types/prebidjs';
import { IModule } from '../types/module';
import { mkConfigureStep } from '../ads/adPipeline';
import { AdSlot } from '../types/moliConfig';

use(sinonChai);

// configureFromEndpoint.ts is a bootstrap script that runs its top-level code as a side effect
// on import (mirroring how it runs once the bundle is loaded on a publisher page). To exercise
// it more than once per test file we clear the require cache and re-require it for every test.
const MODULE_PATH = require.resolve('./configureFromEndpoint');
const loadConfigureFromEndpoint = (): void => {
  delete require.cache[MODULE_PATH];
  require('./configureFromEndpoint');
};

describe('configureFromEndpoint', () => {
  const sandbox = Sinon.createSandbox();

  let dom: JSDOM;
  let jsDomWindow: Window &
    googletag.IGoogleTagWindow &
    prebidjs.IPrebidjsWindow &
    MoliRuntime.MoliWindow;
  let scriptEl: HTMLScriptElement;

  const fakeModule: IModule = {
    description: '',
    moduleType: 'cmp',
    name: '',
    configKey: 'custom',
    config__(): Object | null {
      return null;
    },
    configure__(): void {
      return;
    },
    initSteps__(): [] {
      return [];
    },
    configureSteps__(): [] {
      return [];
    },
    prepareRequestAdsSteps__(): [] {
      return [];
    }
  };

  beforeEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    jsDomWindow.googletag = createGoogletagStub();
    dom.window.__tcfapi = tcfapiFunction(tcData);
    jsDomWindow.pbjs = pbjsStub;
    sandbox.stub(jsDomWindow.document, 'readyState').get(() => 'complete');

    // the script tag configureFromEndpoint.ts looks itself up by id, since jsdom never sets
    // `document.currentScript` for a script that wasn't loaded via a real <script src>
    scriptEl = jsDomWindow.document.createElement('script');
    scriptEl.id = 'moli-ad-tag';
    jsDomWindow.document.body.appendChild(scriptEl);

    // mirrors bundle/init.ts, which always runs before configureFromEndpoint.ts in the real bundle
    (global as any).window = jsDomWindow;
    (global as any).document = jsDomWindow.document;
    initAdTag(jsDomWindow);
  });

  afterEach(() => {
    sandbox.restore();
    delete require.cache[MODULE_PATH];
    delete (global as any).window;
    delete (global as any).document;
  });

  it('does not call setConfig() when data-ad-volume is absent', () => {
    const setConfigSpy = sandbox.spy(jsDomWindow.moli, 'setConfig');
    loadConfigureFromEndpoint();
    expect(setConfigSpy).to.not.have.been.called;
  });

  it('parses data-ad-volume and calls setConfig() with it', () => {
    scriptEl.setAttribute('data-ad-volume', '4');
    const setConfigSpy = sandbox.spy(jsDomWindow.moli, 'setConfig');
    loadConfigureFromEndpoint();
    expect(setConfigSpy).to.have.been.calledOnceWithExactly({ adVolume: 4 });
  });

  it('ignores a malformed data-ad-volume value, fail-open, same as setConfig()', () => {
    scriptEl.setAttribute('data-ad-volume', 'not-a-number');
    const warnSpy = sandbox.spy();
    jsDomWindow.moli.setLogger({
      debug: sandbox.spy(),
      info: sandbox.spy(),
      warn: warnSpy,
      error: sandbox.spy()
    });
    loadConfigureFromEndpoint();
    expect(jsDomWindow.moli.getRuntimeConfig().adVolume).to.be.undefined;
    expect(warnSpy).to.have.been.calledOnce;
  });

  it('produces av1..av4 labels end-to-end from data-ad-volume with zero publisher JS', async () => {
    scriptEl.setAttribute('data-ad-volume', '4');
    loadConfigureFromEndpoint();

    const adDiv = jsDomWindow.document.createElement('div');
    adDiv.id = 'dom-id-1';
    jsDomWindow.document.body.appendChild(adDiv);
    const slot: AdSlot = {
      domId: 'dom-id-1',
      adUnitPath: '/123/ad-unit-1',
      sizes: [],
      position: 'in-page',
      sizeConfig: [],
      behaviour: { loaded: 'eager' }
    };

    let supportedLabels: string[] = [];
    const module: IModule = {
      ...fakeModule,
      name: 'custom',
      configureSteps__: () => [
        mkConfigureStep('label-spy', context => {
          supportedLabels = context.labelConfigService__.getSupportedLabels();
          return Promise.resolve();
        })
      ]
    };

    jsDomWindow.moli.registerModule(module);
    await jsDomWindow.moli.configure({
      ...emptyConfig,
      slots: [slot],
      modules: { custom: { enabled: true } }
    });
    await jsDomWindow.moli.requestAds();

    const avLabels = supportedLabels.filter(label => label.startsWith('av'));
    expect(avLabels).to.have.members(['av1', 'av2', 'av3', 'av4']);
  });
});
