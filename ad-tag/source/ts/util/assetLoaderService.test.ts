import { expect, use } from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { AssetLoaderService, AssetLoadMethod, ILoadAssetParams } from './assetLoaderService';
import { createDom } from '../stubs/browserEnvSetup';

// setup sinon-chai
use(sinonChai);

const sleep = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 5));

describe('AssetLoaderService', () => {
  let assetLoaderService: AssetLoaderService;
  let performanceService;
  const sandbox = sinon.createSandbox();

  let dom = createDom();
  let jsDomWindow: Window = dom.window as any;
  let createElementSpy = sandbox.spy(jsDomWindow.document, 'createElement');

  const resolveOnLoadAndReturnScriptElement = (): HTMLScriptElement => {
    const scriptElements = jsDomWindow.document.querySelectorAll('script');
    expect(scriptElements.length).to.equal(1);
    const scriptElement = scriptElements[0] as HTMLScriptElement;

    scriptElement.onload && scriptElement.onload({} as any);
    return scriptElement;
  };

  beforeEach(() => {
    performanceService = {
      mark: sinon.stub(),
      measure: sinon.stub()
    };

    dom = createDom();
    jsDomWindow = dom.window as any;
    createElementSpy = sandbox.spy(jsDomWindow.document, 'createElement');

    sandbox.stub(jsDomWindow.document, 'addEventListener').callsFake((event, callback) => {
      if (event === 'load' && typeof callback === 'function') {
        callback(null as any); // event is never used
      }
    });

    assetLoaderService = new AssetLoaderService(performanceService, jsDomWindow);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('scriptTag', () => {
    it('should set script type to module if specified', async () => {
      const config: ILoadAssetParams = {
        name: 'testScript',
        assetUrl: 'https://example.com/script.mjs',
        loadMethod: AssetLoadMethod.TAG,
        type: 'module'
      };

      const loadScriptPromise = assetLoaderService.loadScript(config);

      // there are a couple of side effects happening before the script element is there
      await sleep();
      const scriptElement = resolveOnLoadAndReturnScriptElement();
      await loadScriptPromise;

      expect(createElementSpy).to.have.been.calledOnce;
      expect(scriptElement.type).to.equal('module');
      expect(scriptElement.src).to.equal(config.assetUrl);
      expect(scriptElement.getAttribute('nomodule')).to.be.null;
    });

    it('should set script type to text/javascript and nomodule if specified', async () => {
      const config: ILoadAssetParams = {
        name: 'testScript',
        assetUrl: 'https://example.com/script.js',
        loadMethod: AssetLoadMethod.TAG,
        type: 'nomodule'
      };

      const loadScriptPromise = assetLoaderService.loadScript(config);

      // there are a couple of side effects happening before the script element is there
      await sleep();
      const scriptElement = resolveOnLoadAndReturnScriptElement();
      await loadScriptPromise;

      expect(createElementSpy).to.have.been.calledOnce;
      expect(scriptElement.type).to.equal('text/javascript');
      expect(scriptElement.src).to.equal(config.assetUrl);
      expect(scriptElement.getAttribute('nomodule')).to.equal('');
    });

    it('should set script type to module if not specified for .mjs file', async () => {
      const config: ILoadAssetParams = {
        name: 'testScript',
        assetUrl: 'https://example.com/script.mjs',
        loadMethod: AssetLoadMethod.TAG
      };

      const loadScriptPromise = assetLoaderService.loadScript(config);

      // there are a couple of side effects happening before the script element is there
      await sleep();
      const scriptElement = resolveOnLoadAndReturnScriptElement();
      await loadScriptPromise;

      expect(createElementSpy).to.have.been.calledOnce;
      expect(scriptElement.type).to.equal('module');
      expect(scriptElement.src).to.equal(config.assetUrl);
      expect(scriptElement.getAttribute('nomodule')).to.be.null;
    });

    it('should set script type to text/javascript if not specified for .js file', async () => {
      const config: ILoadAssetParams = {
        name: 'testScript',
        assetUrl: 'https://example.com/script.js',
        loadMethod: AssetLoadMethod.TAG
      };

      const loadScriptPromise = assetLoaderService.loadScript(config);

      // there are a couple of side effects happening before the script element is there
      await sleep();
      const scriptElement = resolveOnLoadAndReturnScriptElement();
      await loadScriptPromise;

      expect(createElementSpy).to.have.been.calledOnce;
      expect(scriptElement.type).to.equal('text/javascript');
      expect(scriptElement.src).to.equal(config.assetUrl);
    });
  });
});
