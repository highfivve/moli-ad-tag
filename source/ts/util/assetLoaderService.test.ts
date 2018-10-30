import test, { GenericTestContext } from 'ava';
import Sinon = require('sinon');
import browserEnv = require('browser-env');
import SinonSpy = Sinon.SinonSpy;

import {
  AssetLoaderService, AssetLoadMethod, AssetType, IAssetLoaderService, ILoadAssetParams
} from './assetLoaderService';
import { PerformanceMeasurementServiceFactory } from '../performanceService';

interface ITestContext {
  services: {
    assetLoader: IAssetLoaderService
  };
  config: ILoadAssetParams;
  stubs: {
    appendChild: SinonSpy
  };
  elements: {
    scriptTag: HTMLScriptElement,
    styleTag: HTMLStyleElement,
    linkTag: HTMLLinkElement
  };
  fetchStub: SinonSpy;
}

test.beforeEach((t: GenericTestContext<any>) => {
  browserEnv(['document']);

  const context = t.context as ITestContext;
  context.services = {
    assetLoader: new AssetLoaderService(PerformanceMeasurementServiceFactory.createInstance())
  };
  context.config = {
    name: 'test',
    assetType: undefined!,
    assetUrl: '//localhost',
    loadMethod: undefined!
  };
  context.elements = {
    scriptTag: document.createElement('script'),
    styleTag: document.createElement('style'),
    linkTag: document.createElement('link')
  };
  context.stubs = {
    appendChild: Sinon.spy(document.head!, 'appendChild')
  };

  (<any>window).fetch = (): any => null;

  context.fetchStub = Sinon.stub(window, 'fetch').callsFake(() => Promise.resolve({
    ok: true,
    text: (): string => 'content'
  }));
});

test.afterEach((t: GenericTestContext<any>) => {
  t.context.fetchStub.restore();
});


test.serial('load and execute script via fetch', (t: GenericTestContext<any>) => {
  const context = <ITestContext> t.context;
  const config = t.context.config;
  config.assetType = AssetType.SCRIPT;
  config.loadMethod = AssetLoadMethod.FETCH;

  const createElementStub = Sinon.stub(document, 'createElement').returns(context.elements.scriptTag);
  const scriptTag = context.elements.scriptTag;

  return context.services.assetLoader.loadAsset(config).then(() => {
    Sinon.assert.calledWith(context.fetchStub, config.assetUrl);
    Sinon.assert.calledOnce(createElementStub);
    t.is('content', scriptTag.text, 'Text property must be "content"');
    t.is('text/javascript', scriptTag.type, 'Type must be "text/javascript"');
    t.is(true, scriptTag.async, 'Async property must be true');

    Sinon.assert.calledWith(context.stubs.appendChild, scriptTag);
    createElementStub.restore();
  });
});

test.serial('load and execute script via script tag', (t: GenericTestContext<any>) => {
  const context = <ITestContext> t.context;
  const config = t.context.config;
  config.assetType = AssetType.SCRIPT;
  config.loadMethod = AssetLoadMethod.TAG;

  const createElementStub = Sinon.stub(document, 'createElement').returns(context.elements.scriptTag);
  const scriptTag = context.elements.scriptTag;
  Sinon.assert.notCalled(createElementStub);

  // trigger the onload function to resolve the promise
  window.setTimeout(() => {
    // Just force the parameter for this test; it's not used anyway, and it's just a test O_O
    if (scriptTag.onload) {
      scriptTag.onload(null!);
    }
  }, 200);

  return context.services.assetLoader.loadAsset(config).then(() => {
    t.true(createElementStub.calledOnce);
    t.is('text/javascript', scriptTag.type, 'Type must be "text/javascript"');
    t.is(true, scriptTag.async, 'Async property must be true');

    Sinon.assert.calledWith(context.stubs.appendChild, scriptTag);
    createElementStub.restore();
  });
});

test.serial('load style via fetch', (t: GenericTestContext<any>) => {
  const context = <ITestContext> t.context;
  const config = t.context.config;
  config.assetType = AssetType.STYLE;
  config.loadMethod = AssetLoadMethod.FETCH;

  const createElementStub = Sinon.stub(document, 'createElement').returns(context.elements.styleTag);
  const styleTag = context.elements.styleTag;

  return context.services.assetLoader.loadAsset(config).then(() => {
    // I haven't found a clue where this methods gets called the second time.
    // Resetting the spy/stub doesn't help
    // Reordering the tests has also no effect ( note that tests are executed serially )
    Sinon.assert.calledWith(context.fetchStub, config.assetUrl);
    Sinon.assert.calledTwice(createElementStub);
    t.is('content', styleTag.innerText, 'Text property must be "content"');
    t.is('text/css', styleTag.type, 'Type must be "text/css"');

    Sinon.assert.calledWith(context.stubs.appendChild, styleTag);
    createElementStub.restore();
  });
});

test.serial('load style via link tag', (t: GenericTestContext<any>) => {
  const context = <ITestContext> t.context;
  const config = t.context.config;
  config.assetType = AssetType.STYLE;
  config.loadMethod = AssetLoadMethod.TAG;

  const createElementStub = Sinon.stub(document, 'createElement').returns(context.elements.linkTag);
  const linkTag = context.elements.linkTag;
  Sinon.assert.notCalled(createElementStub);

  // trigger the onload function to resolve the promise
  window.setTimeout(() => {
    // Just force the parameter for this test; it's not used anyway, and it's just a test O_O
    if (linkTag.onload) {
      linkTag.onload(null!);
    }
  }, 200);

  return context.services.assetLoader.loadAsset(config).then(() => {
    // I haven't found a clue where this methods gets called the second time.
    // Resetting the spy/stub doesn't help
    // Reordering the tests has also no effect ( note that tests are executed serially )
    Sinon.assert.calledTwice(createElementStub);
    t.is('stylesheet', linkTag.rel, 'Relation must be "stylesheet"');
    t.is('//localhost', linkTag.href, 'Anchor must be "//locahost');

    Sinon.assert.calledWith(context.stubs.appendChild, linkTag);
    createElementStub.restore();
  });
});
