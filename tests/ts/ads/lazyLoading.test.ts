import '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';

import { createLazyLoader } from '../../../source/ts/ads/lazyLoading';


// setup sinon-chai
use(sinonChai);


// tslint:disable: no-unused-expression
describe('Lazy Loading', () => {

  const sleep = () => new Promise(resolve => {
    setTimeout(resolve, 20);
  });


  describe('Event lazy loader', () => {
    it('should trigger when the required event is fired on window', () => {
      const eventLoader = createLazyLoader({
        name: 'event',
        event: 'trigger-event',
        source: window
      });

      const onLoad = eventLoader.onLoad();
      window.dispatchEvent(new Event('trigger-event', {}));

      return onLoad;
    });

    it('should trigger when the required event is fired on document', () => {
      const eventLoader = createLazyLoader({
        name: 'event',
        event: 'trigger-event',
        source: document
      });

      const onLoad = eventLoader.onLoad();
      document.dispatchEvent(new Event('trigger-event', {}));

      return onLoad;
    });

    it('should trigger when the required event is fired on a dom node', () => {
      const eventLoader = createLazyLoader({
        name: 'event',
        event: 'trigger-event',
        source: '#lazy-trigger-element'
      });

      const div = document.createElement('div');
      div.id = 'lazy-trigger-element';
      document.body.append(div);


      const onLoad = eventLoader.onLoad();
      div.dispatchEvent(new Event('trigger-event', {}));

      return onLoad;
    });

    it('should not trigger when no event is fired', () => {
      const eventLoader = createLazyLoader({
        name: 'event',
        event: 'trigger-event',
        source: window
      });

      const onLoad: Promise<boolean> = eventLoader.onLoad().then(() => true);
      const race: Promise<boolean> = sleep().then(() => false);

      return Promise.race<boolean>([onLoad, race]).then((called) => {
        expect(called).to.be.false;
      });
    });

    it('should not trigger when another event is fired', () => {
      const eventLoader = createLazyLoader({
        name: 'event',
        event: 'trigger-event',
        source: window
      });

      const onLoad: Promise<boolean> = eventLoader.onLoad().then(() => true);
      window.dispatchEvent(new Event('another-event', {}));
      const race: Promise<boolean> = sleep().then(() => false);

      return Promise.race<boolean>([onLoad, race]).then((called) => {
        expect(called).to.be.false;
      });
    });

    it('should not trigger when event is fired on another source', () => {
      const eventLoader = createLazyLoader({
        name: 'event',
        event: 'trigger-event',
        source: window
      });

      const onLoad: Promise<boolean> = eventLoader.onLoad().then(() => true);
      document.dispatchEvent(new Event('trigger-event', {}));
      const race: Promise<boolean> = sleep().then(() => false);

      return Promise.race<boolean>([onLoad, race]).then((called) => {
        expect(called).to.be.false;
      });
    });

  });

});
// tslint:enable
