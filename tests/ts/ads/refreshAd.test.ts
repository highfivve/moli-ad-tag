import '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';

import { createRefreshListener } from '../../../source/ts/ads/refreshAd';


// setup sinon-chai
use(sinonChai);


// tslint:disable: no-unused-expression
describe('Refreshable Loading', () => {

  const sleep = () => new Promise(resolve => {
    setTimeout(resolve, 20);
  });


  describe('Event refreshable listener', () => {
    it('should trigger when the required event is fired', () => {
      const refreshListener = createRefreshListener({
        name: 'event',
        event: 'trigger-event'
      });

      const onRefresh = new Promise(resolve => {
        refreshListener.addAdRefreshListener(() => {
          resolve();
        });
      });
      window.dispatchEvent(new Event('trigger-event', {}));

      return onRefresh;
    });

    it('should trigger multiple times when multiple events are fired', () => {
      const refreshListener = createRefreshListener({
        name: 'event',
        event: 'trigger-event'
      });

      const onRefresh: Promise<boolean> = new Promise(resolve => {
        let counter = 0;
        refreshListener.addAdRefreshListener(() => {
          if (counter++ === 2) {
            resolve(true);
          }
        });
      });
      // dispatch three events
      window.dispatchEvent(new Event('trigger-event', {}));
      window.dispatchEvent(new Event('trigger-event', {}));
      window.dispatchEvent(new Event('trigger-event', {}));

      return onRefresh;
    });

    it('should not trigger when no event is fired', () => {
      const refreshListener = createRefreshListener({
        name: 'event',
        event: 'trigger-event'
      });

      const onRefresh: Promise<boolean> = new Promise(resolve => {
        refreshListener.addAdRefreshListener(() => {
          resolve(true);
        });
      });
      const race: Promise<boolean> = sleep().then(() => false);

      return Promise.race<boolean>([onRefresh, race]).then((called) => {
        expect(called).to.be.false;
      });
    });

    it('should not trigger when another event is fired', () => {
      const refreshListener = createRefreshListener({
        name: 'event',
        event: 'trigger-event'
      });

      const onRefresh: Promise<boolean> = new Promise(resolve => {
        refreshListener.addAdRefreshListener(() => {
          resolve(true);
        });
      });
      window.dispatchEvent(new Event('another-event', {}));
      const race: Promise<boolean> = sleep().then(() => false);

      return Promise.race<boolean>([onRefresh, race]).then((called) => {
        expect(called).to.be.false;
      });
    });
  });

});
// tslint:enable
