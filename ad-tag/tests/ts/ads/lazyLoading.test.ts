import { createDom } from '../stubs/browserEnvSetup';
import { noopLogger } from '../stubs/moliStubs';
import { expect, use } from 'chai';

import * as sinonChai from 'sinon-chai';
import { createLazyLoader } from '../../../source/ts/ads/lazyLoading';
import { SlotEventService } from '../../../source/ts/ads/slotEventService';


// setup sinon-chai
use(sinonChai);


// tslint:disable: no-unused-expression
describe('Lazy Loading', () => {

  const sleep = () => new Promise(resolve => {
    setTimeout(resolve, 20);
  });

  let dom = createDom();
  let slotEventService = new SlotEventService(noopLogger);

  beforeEach(() => {
    dom = createDom();
    slotEventService = new SlotEventService(noopLogger);
  });


  describe('Event lazy loader', () => {
    it('should trigger when the required event is fired on window', () => {
      const eventLoader = createLazyLoader({
        name: 'event',
        event: 'trigger-event',
        source: dom.window
      }, slotEventService, dom.window);

      const onLoad = eventLoader.onLoad();
      dom.window.dispatchEvent(new dom.window.Event('trigger-event', {}));

      return onLoad;
    });

    it('should trigger when the required event is fired on document', () => {
      const eventLoader = createLazyLoader({
        name: 'event',
        event: 'trigger-event',
        source: dom.window.document
      }, slotEventService, dom.window);

      const onLoad = eventLoader.onLoad();
      dom.window.document.dispatchEvent(new dom.window.Event('trigger-event', {}));

      return onLoad;
    });

    it('should trigger when the required event is fired on a dom node', () => {
      const eventLoader = createLazyLoader({
        name: 'event',
        event: 'trigger-event',
        source: '#lazy-trigger-element'
      }, slotEventService, dom.window);

      const div = dom.window.document.createElement('div');
      div.id = 'lazy-trigger-element';
      dom.window.document.body.append(div);


      const onLoad = eventLoader.onLoad();
      div.dispatchEvent(new dom.window.Event('trigger-event', {}));

      return onLoad;
    });

    it('should not trigger when no event is fired', () => {
      const eventLoader = createLazyLoader({
        name: 'event',
        event: 'dom.window-event',
        source: dom.window
      }, slotEventService, dom.window);

      const onLoad: Promise<boolean> = eventLoader.onLoad().then(() => true);
      const race: Promise<boolean> = sleep().then(() => false);

      return Promise.race<boolean>([ onLoad, race ]).then((called) => {
        expect(called).to.be.false;
      });
    });

    it('should not trigger when another event is fired', () => {
      const eventLoader = createLazyLoader({
        name: 'event',
        event: 'trigger-event',
        source: dom.window
      }, slotEventService, dom.window);

      const onLoad: Promise<boolean> = eventLoader.onLoad().then(() => true);
      dom.window.dispatchEvent(new dom.window.Event('another-event', {}));
      const race: Promise<boolean> = sleep().then(() => false);

      return Promise.race<boolean>([ onLoad, race ]).then((called) => {
        expect(called).to.be.false;
      });
    });

    it('should not trigger when event is fired on another source', () => {
      const eventLoader = createLazyLoader({
        name: 'event',
        event: 'trigger-event',
        source: dom.window
      }, slotEventService, dom.window);

      const onLoad: Promise<boolean> = eventLoader.onLoad().then(() => true);
      dom.window.document.dispatchEvent(new dom.window.Event('trigger-event', {}));
      const race: Promise<boolean> = sleep().then(() => false);

      return Promise.race<boolean>([ onLoad, race ]).then((called) => {
        expect(called).to.be.false;
      });
    });

    it('should trigger only once when the required event is fired', () => {
      const eventLoader = createLazyLoader({
        name: 'event',
        event: 'trigger-event',
        source: dom.window
      }, slotEventService, dom.window);

      const onLoad = eventLoader.onLoad();
      dom.window.dispatchEvent(new dom.window.Event('trigger-event', {}));
      dom.window.dispatchEvent(new dom.window.Event('trigger-event', {}));

      return onLoad;
    });

  });

});
// tslint:enable
