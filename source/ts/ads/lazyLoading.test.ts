import test, { Context, GenericTestContext } from 'ava';
import { SinonSandbox } from 'sinon';
import * as LazyLoading from './lazyLoading';
import { IScrollService, scrollService } from '../../dom/scrollService';
import { IWindowEventService, WindowEventService } from '../../dom/windowEventService';
import Sinon = require('sinon');
import browserEnv = require('browser-env');

interface ILazyLoadingTestContext {
  sandbox: SinonSandbox;
  stubs: {
    scrollService: IScrollService;
    windowEventService: IWindowEventService;
  };

  createAnswerPlate(index: number): HTMLDivElement;
  dispatchScrollEvent(): void;
  dispatchAnswersLoadedEvent(pagination: number): void;
  dispatchQdpSidebar2LoadedEvent(): void;
}

test.beforeEach((t: GenericTestContext<Context<ILazyLoadingTestContext>>) => {
  browserEnv(['document']);

  t.context.sandbox = Sinon.createSandbox();
  t.context.stubs = {
    scrollService, windowEventService: new WindowEventService()
  };

  t.context.createAnswerPlate = (index: number) => {
    const answerPlate = document.createElement('div');
    answerPlate.classList.add('Plate');
    answerPlate.classList.add('Ad');
    answerPlate.id = `ad-answerstream-${index}`;
    answerPlate.setAttribute('data-ref', 'Answer');
    document.body.appendChild(answerPlate);
    return answerPlate;
  };

  t.context.dispatchScrollEvent = () => {
    window.dispatchEvent(new CustomEvent('scroll'));
  };

  t.context.dispatchQdpSidebar2LoadedEvent = () => {
    window.dispatchEvent(new CustomEvent('qdp.sidebar.2.loaded'));
  };

});

test.afterEach.always((t: GenericTestContext<Context<ILazyLoadingTestContext>>) => {
  t.context.sandbox.restore();
});

test.serial('LazyLoading.FooterVisible - Resolves when the footer is visible', (t: GenericTestContext<Context<ILazyLoadingTestContext>>) => {
  const sandbox = t.context.sandbox;
  const stubs = t.context.stubs;

  // add footer to DOM
  const footer = document.createElement('footer');
  document.body.appendChild(footer);

  // footer plate is visible
  const elementVisibleSpy = sandbox.stub(stubs.scrollService, 'elementInOrAboveViewport').returns(true);

  const lazy = LazyLoading.FooterVisible(
    stubs.scrollService,
    stubs.windowEventService
  );

  // Create promise and register listener
  const onLoad = lazy.onLoad();

  t.context.dispatchScrollEvent();

  return t.notThrows(onLoad).then(() => {
    Sinon.assert.called(elementVisibleSpy);
  });
});

test.serial('LazyLoading.QdpSidebar2Loaded - Resolves when QDP Sidebar2 is loaded', (t: GenericTestContext<Context<ILazyLoadingTestContext>>) => {
  // create logic
  const lazy = LazyLoading.QdpSidebar2Loaded();

  // Create promise and register listener
  const onLoad = lazy.onLoad();

  t.context.dispatchQdpSidebar2LoadedEvent();

  return t.notThrows(onLoad).then(() => {
    t.pass('resolved successfully');
  });
});
