import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { EventService } from 'ad-tag/ads/eventService';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';

use(sinonChai);

describe('EventService', () => {
  const sandbox = Sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  describe('addEventListener', () => {
    it('should add regular event listener', () => {
      const service = new EventService();
      const listener = sandbox.spy();
      const runtimeConfig = {} as MoliRuntime.MoliRuntimeConfig;

      service.addEventListener('beforeRequestAds', listener);
      service.emit('beforeRequestAds', { runtimeConfig });

      expect(listener).to.be.calledOnce;
      expect(listener).to.be.calledWith({ runtimeConfig });
    });

    it('should add multiple regular event listeners for same event', () => {
      const service = new EventService();
      const listener1 = sandbox.spy();
      const listener2 = sandbox.spy();
      const runtimeConfig = {} as MoliRuntime.MoliRuntimeConfig;

      service.addEventListener('beforeRequestAds', listener1);
      service.addEventListener('beforeRequestAds', listener2);
      service.emit('beforeRequestAds', { runtimeConfig });

      expect(listener1).to.be.calledOnce;
      expect(listener2).to.be.calledOnce;
      expect(listener1).to.be.calledWith({ runtimeConfig });
      expect(listener2).to.be.calledWith({ runtimeConfig });
    });

    it('should add one-time event listener that is called only once', () => {
      const service = new EventService();
      const listener = sandbox.spy();
      const runtimeConfig = {} as MoliRuntime.MoliRuntimeConfig;

      service.addEventListener('beforeRequestAds', listener, { once: true });

      service.emit('beforeRequestAds', { runtimeConfig });
      service.emit('beforeRequestAds', { runtimeConfig });

      expect(listener).to.be.calledOnce;
      expect(listener).to.be.calledWith({ runtimeConfig });
    });

    it('should handle multiple one-time listeners for same event', () => {
      const service = new EventService();
      const listener1 = sandbox.spy();
      const listener2 = sandbox.spy();
      const runtimeConfig = {} as MoliRuntime.MoliRuntimeConfig;

      service.addEventListener('beforeRequestAds', listener1, { once: true });
      service.addEventListener('beforeRequestAds', listener2, { once: true });

      service.emit('beforeRequestAds', { runtimeConfig });
      service.emit('beforeRequestAds', { runtimeConfig });

      expect(listener1).to.be.calledOnce;
      expect(listener2).to.be.calledOnce;
      expect(listener1).to.be.calledWith({ runtimeConfig });
      expect(listener2).to.be.calledWith({ runtimeConfig });
    });

    it('should handle mix of regular and one-time listeners', () => {
      const service = new EventService();
      const regularListener = sandbox.spy();
      const oneTimeListener = sandbox.spy();
      const runtimeConfig = {} as MoliRuntime.MoliRuntimeConfig;

      service.addEventListener('beforeRequestAds', regularListener);
      service.addEventListener('beforeRequestAds', oneTimeListener, { once: true });

      service.emit('beforeRequestAds', { runtimeConfig });
      service.emit('beforeRequestAds', { runtimeConfig });

      expect(regularListener).to.be.calledTwice;
      expect(oneTimeListener).to.be.calledOnce;
      expect(regularListener).to.be.calledWith({ runtimeConfig });
      expect(oneTimeListener).to.be.calledWith({ runtimeConfig });
    });
  });

  describe('removeEventListener', () => {
    it('should remove regular event listener', () => {
      const service = new EventService();
      const listener = sandbox.spy();
      const runtimeConfig = {} as MoliRuntime.MoliRuntimeConfig;

      service.addEventListener('beforeRequestAds', listener);
      service.removeEventListener('beforeRequestAds', listener);
      service.emit('beforeRequestAds', { runtimeConfig });

      expect(listener).to.not.be.called;
    });

    it('should remove one-time event listener before it is called', () => {
      const service = new EventService();
      const listener = sandbox.spy();
      const runtimeConfig = {} as MoliRuntime.MoliRuntimeConfig;

      service.addEventListener('beforeRequestAds', listener, { once: true });
      service.removeEventListener('beforeRequestAds', listener);
      service.emit('beforeRequestAds', { runtimeConfig });

      expect(listener).to.not.be.called;
    });

    it('should handle removing non-existent listener', () => {
      const service = new EventService();
      const listener = sandbox.spy();

      // Should not throw
      service.removeEventListener('beforeRequestAds', listener);
    });
  });

  describe('emit', () => {
    let consoleErrorStub: Sinon.SinonStub;

    beforeEach(() => {
      consoleErrorStub = sandbox.stub(console, 'error');
    });

    it('should not throw when emitting event with no listeners', () => {
      const service = new EventService();
      const runtimeConfig = {} as MoliRuntime.MoliRuntimeConfig;

      // Should not throw
      service.emit('beforeRequestAds', { runtimeConfig });
    });

    it('should emit events independently', () => {
      const service = new EventService();
      const beforeListener = sandbox.spy();
      const afterListener = sandbox.spy();
      const runtimeConfig = {} as MoliRuntime.MoliRuntimeConfig;

      service.addEventListener('beforeRequestAds', beforeListener);
      service.addEventListener('afterRequestAds', afterListener);

      service.emit('beforeRequestAds', { runtimeConfig });

      expect(beforeListener).to.be.calledOnce;
      expect(beforeListener).to.be.calledWith({ runtimeConfig });
      expect(afterListener).to.not.be.called;
    });

    it('should emit afterRequestAds with correct state', () => {
      const service = new EventService();
      const afterListener = sandbox.spy();

      service.addEventListener('afterRequestAds', afterListener);
      service.emit('afterRequestAds', { state: 'finished' });

      expect(afterListener).to.be.calledOnce;
      expect(afterListener).to.be.calledWith({ state: 'finished' });
    });

    describe('error handling', () => {
      it('should continue executing other listeners when one throws', () => {
        const service = new EventService();
        const errorListener = sandbox.stub().throws(new Error('Test error'));
        const goodListener = sandbox.spy();
        const runtimeConfig = {} as MoliRuntime.MoliRuntimeConfig;

        service.addEventListener('beforeRequestAds', errorListener);
        service.addEventListener('beforeRequestAds', goodListener);

        service.emit('beforeRequestAds', { runtimeConfig });

        expect(errorListener).to.be.calledOnce;
        expect(goodListener).to.be.calledOnce;
        expect(consoleErrorStub).to.be.calledOnce;
        expect(consoleErrorStub.firstCall.args[0]).to.equal(
          'Error in event listener for beforeRequestAds:'
        );
      });

      it('should remove one-time listeners even if they throw', () => {
        const service = new EventService();
        const errorListener = sandbox.stub().throws(new Error('Test error'));
        const runtimeConfig = {} as MoliRuntime.MoliRuntimeConfig;

        service.addEventListener('beforeRequestAds', errorListener, { once: true });

        // First emission should trigger and remove the listener
        service.emit('beforeRequestAds', { runtimeConfig });
        expect(errorListener).to.be.calledOnce;
        expect(consoleErrorStub).to.be.calledOnce;

        // Second emission should not call the listener again
        service.emit('beforeRequestAds', { runtimeConfig });
        expect(errorListener).to.be.calledOnce; // Still only called once
      });

      it('should handle multiple throwing listeners', () => {
        const service = new EventService();
        const error1 = new Error('Error 1');
        const error2 = new Error('Error 2');
        const errorListener1 = sandbox.stub().throws(error1);
        const errorListener2 = sandbox.stub().throws(error2);
        const goodListener = sandbox.spy();
        const runtimeConfig = {} as MoliRuntime.MoliRuntimeConfig;

        service.addEventListener('beforeRequestAds', errorListener1);
        service.addEventListener('beforeRequestAds', errorListener2);
        service.addEventListener('beforeRequestAds', goodListener);

        service.emit('beforeRequestAds', { runtimeConfig });

        expect(errorListener1).to.be.calledOnce;
        expect(errorListener2).to.be.calledOnce;
        expect(goodListener).to.be.calledOnce;
        expect(consoleErrorStub).to.be.calledTwice;
        expect(consoleErrorStub.firstCall.args[1]).to.equal(error1);
        expect(consoleErrorStub.secondCall.args[1]).to.equal(error2);
      });

      it('should clean up one-time listeners map when all listeners are removed', () => {
        const service = new EventService();
        const errorListener = sandbox.stub().throws(new Error('Test error'));
        const goodListener = sandbox.spy();
        const runtimeConfig = {} as MoliRuntime.MoliRuntimeConfig;

        service.addEventListener('beforeRequestAds', errorListener, { once: true });
        service.addEventListener('beforeRequestAds', goodListener, { once: true });

        service.emit('beforeRequestAds', { runtimeConfig });

        // Both listeners should be called and removed
        expect(errorListener).to.be.calledOnce;
        expect(goodListener).to.be.calledOnce;
        expect(consoleErrorStub).to.be.calledOnce;

        // Second emission should not call any listeners
        service.emit('beforeRequestAds', { runtimeConfig });
        expect(errorListener).to.be.calledOnce; // Still only called once
        expect(goodListener).to.be.calledOnce; // Still only called once
      });
    });
  });
});
