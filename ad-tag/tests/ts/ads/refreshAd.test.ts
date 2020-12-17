import { createDom } from '../stubs/browserEnvSetup';
import { noopLogger } from '../stubs/moliStubs';
import { expect, use } from 'chai';

import sinonChai from 'sinon-chai';
import { createRefreshListener } from '../../../source/ts/ads/refreshAd';
import { SlotEventService } from '../../../source/ts/ads/slotEventService';

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('Refreshable Loading', () => {
  const sleep = () =>
    new Promise(resolve => {
      setTimeout(resolve, 20);
    });

  const dom = createDom();
  const jsDomWindow: Window = dom.window as any;
  const slotEventService = new SlotEventService(noopLogger);

  describe('Event refreshable listener', () => {
    it('should trigger when the required event is fired on window', () => {
      const refreshListener = createRefreshListener(
        {
          name: 'event',
          event: 'trigger-event',
          source: jsDomWindow
        },
        undefined,
        slotEventService,
        jsDomWindow
      );

      const onRefresh = new Promise<void>(resolve => {
        refreshListener.addAdRefreshListener(() => {
          resolve();
        });
      });
      dom.window.dispatchEvent(new dom.window.Event('trigger-event', {}));

      return onRefresh;
    });

    it('should trigger when the required event is fired on document', () => {
      const refreshListener = createRefreshListener(
        {
          name: 'event',
          event: 'trigger-event',
          source: dom.window.document
        },
        undefined,
        slotEventService,
        jsDomWindow
      );

      const onRefresh = new Promise<void>(resolve => {
        refreshListener.addAdRefreshListener(() => {
          resolve();
        });
      });
      dom.window.document.dispatchEvent(new dom.window.Event('trigger-event', {}));

      return onRefresh;
    });

    it('should trigger when the required event is fired on a dom node', () => {
      const refreshListener = createRefreshListener(
        {
          name: 'event',
          event: 'trigger-event',
          source: '#refresh-trigger-element'
        },
        undefined,
        slotEventService,
        jsDomWindow
      );

      const div = dom.window.document.createElement('div');
      div.id = 'refresh-trigger-element';
      dom.window.document.body.append(div);

      const onRefresh = new Promise<void>(resolve => {
        refreshListener.addAdRefreshListener(() => {
          resolve();
        });
      });
      div.dispatchEvent(new dom.window.Event('trigger-event', {}));

      return onRefresh;
    });

    it('should trigger multiple times when multiple events are fired', () => {
      const refreshListener = createRefreshListener(
        {
          name: 'event',
          event: 'trigger-event',
          source: jsDomWindow
        },
        undefined,
        slotEventService,
        jsDomWindow
      );

      const onRefresh: Promise<boolean> = new Promise(resolve => {
        let counter = 0;
        refreshListener.addAdRefreshListener(() => {
          if (counter++ === 2) {
            resolve(true);
          }
        });
      });
      // dispatch three events
      dom.window.dispatchEvent(new dom.window.Event('trigger-event', {}));
      dom.window.dispatchEvent(new dom.window.Event('trigger-event', {}));
      dom.window.dispatchEvent(new dom.window.Event('trigger-event', {}));

      return onRefresh;
    });

    it('should not trigger when no event is fired', () => {
      const refreshListener = createRefreshListener(
        {
          name: 'event',
          event: 'trigger-event',
          source: jsDomWindow
        },
        undefined,
        slotEventService,
        jsDomWindow
      );

      const onRefresh: Promise<boolean> = new Promise(resolve => {
        refreshListener.addAdRefreshListener(() => {
          resolve(true);
        });
      });
      const race: Promise<boolean> = sleep().then(() => false);

      return Promise.race<boolean>([onRefresh, race]).then(called => {
        expect(called).to.be.false;
      });
    });

    it('should not trigger when another event is fired', () => {
      const refreshListener = createRefreshListener(
        {
          name: 'event',
          event: 'trigger-event',
          source: jsDomWindow
        },
        undefined,
        slotEventService,
        jsDomWindow
      );

      const onRefresh: Promise<boolean> = new Promise(resolve => {
        refreshListener.addAdRefreshListener(() => {
          resolve(true);
        });
      });
      dom.window.dispatchEvent(new dom.window.Event('another-event', {}));
      const race: Promise<boolean> = sleep().then(() => false);

      return Promise.race<boolean>([onRefresh, race]).then(called => {
        expect(called).to.be.false;
      });
    });

    it('should not trigger when event is fired on another source', () => {
      const refreshListener = createRefreshListener(
        {
          name: 'event',
          event: 'trigger-event',
          source: jsDomWindow
        },
        undefined,
        slotEventService,
        jsDomWindow
      );

      const onRefresh: Promise<boolean> = new Promise(resolve => {
        refreshListener.addAdRefreshListener(() => {
          resolve(true);
        });
      });
      dom.window.document.dispatchEvent(new dom.window.Event('trigger-event', {}));
      const race: Promise<boolean> = sleep().then(() => false);

      return Promise.race<boolean>([onRefresh, race]).then(called => {
        expect(called).to.be.false;
      });
    });
  });
});
// tslint:enable
