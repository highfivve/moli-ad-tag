import { createDom } from '../stubs/browserEnvSetup';
import { noopLogger } from '../stubs/moliStubs';
import { createGoogletagStub, googleAdSlotStub } from '../stubs/googletagStubs';
import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { PassbackService } from '../../../source/ts/ads/passbackService';
import { Moli } from '../../../source/ts/types/moli';

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('Passback Service', () => {
  // create a fresh DOM for each test
  let dom = createDom();
  const gpt = createGoogletagStub();
  const pubads = gpt.pubads();
  dom.window.googletag = gpt;

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();
  const pubadsRefreshSpy = sandbox.spy(pubads, 'refresh');

  const postMessage = (data: any): Promise<void> => {
    dom.window.postMessage(data, '*');
    let finishListener: (event: MessageEvent) => void;

    return new Promise((resolve, reject) => {
      finishListener = event => {
        if (event.data === data) {
          resolve();
        } else {
          reject(`got an unexpected message ${data}`);
        }
        dom.window.removeEventListener('message', finishListener);
      };
      dom.window.addEventListener('message', finishListener);
    });
  };

  beforeEach(() => {
    dom = createDom();
    dom.window.googletag = gpt;
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('passback message with domId', () => {
    it('should not initialize the event listener if no ad slot is added', () => {
      const addEventListenerSpy = sandbox.spy(dom.window, 'addEventListener');
      new PassbackService(noopLogger, dom.window);
      expect(addEventListenerSpy).to.have.not.been.called;
    });

    it('should initialize the message listener only once', () => {
      const addEventListenerSpy = sandbox.spy(dom.window, 'addEventListener');
      const passbackService = new PassbackService(noopLogger, dom.window);

      passbackService.addAdSlot({
        moliSlot: { domId: 'foo' }
      } as any);

      passbackService.addAdSlot({
        moliSlot: { domId: 'bar' }
      } as any);

      expect(addEventListenerSpy).to.have.been.calledOnce;
      expect(addEventListenerSpy).to.have.been.calledOnceWith(
        Sinon.match.same('message'),
        Sinon.match.func
      );
    });

    it('should not refresh a slot when the domId does not match', () => {
      const passbackService = new PassbackService(noopLogger, dom.window);
      const googleAdSlot = googleAdSlotStub('/1/foo', 'foo');

      const googleAdSlotSetTargetingSpy = sandbox.spy(googleAdSlot, 'setTargeting');
      const adSlotDefinition: Moli.SlotDefinition<any> = {
        moliSlot: { domId: 'foo' } as any,
        adSlot: googleAdSlot,
        filterSupportedSizes: {} as any
      };

      passbackService.addAdSlot(adSlotDefinition);

      return postMessage(
        JSON.stringify({
          type: 'passback',
          domId: 'another-slot',
          passbackOrigin: 'outstream-partner-1'
        })
      ).then(() => {
        expect(pubadsRefreshSpy).to.have.not.been.called;
        expect(googleAdSlotSetTargetingSpy).to.have.not.been.called;
      });
    });

    it('should refresh a slot when the proper event is fired', () => {
      const passbackService = new PassbackService(noopLogger, dom.window);
      const googleAdSlot = googleAdSlotStub('/1/foo', 'foo');

      const googleAdSlotSetTargetingSpy = sandbox.spy(googleAdSlot, 'setTargeting');
      const adSlotDefinition: Moli.SlotDefinition<any> = {
        moliSlot: { domId: 'foo' } as any,
        adSlot: googleAdSlot,
        filterSupportedSizes: {} as any
      };

      passbackService.addAdSlot(adSlotDefinition);

      return postMessage(
        JSON.stringify({ type: 'passback', domId: 'foo', passbackOrigin: 'outstream-partner-1' })
      ).then(() => {
        expect(pubadsRefreshSpy).to.have.be.calledOnce;
        expect(pubadsRefreshSpy).to.have.be.calledOnceWithExactly(
          Sinon.match.array.and(
            Sinon.match(adSlots => {
              return adSlots.length === 1 && adSlots[0].getSlotElementId() === 'foo';
            }, 'more or less than 1 ad slot used OR wrong slot')
          )
        );

        expect(googleAdSlotSetTargetingSpy).to.have.been.calledTwice;
        expect(googleAdSlotSetTargetingSpy.firstCall.args[0]).to.be.equals('passback');
        expect(googleAdSlotSetTargetingSpy.firstCall.args[1]).to.be.equals('true');
        expect(googleAdSlotSetTargetingSpy.secondCall.args[0]).to.be.equals('passbackOrigin');
        expect(googleAdSlotSetTargetingSpy.secondCall.args[1]).to.be.equals('outstream-partner-1');
      });
    });

    it('should allow passbacks only once', () => {
      const passbackService = new PassbackService(noopLogger, dom.window);
      const googleAdSlot = googleAdSlotStub('/1/foo', 'foo');

      const adSlotDefinition: Moli.SlotDefinition<any> = {
        moliSlot: { domId: 'foo' } as any,
        adSlot: googleAdSlot,
        filterSupportedSizes: {} as any
      };

      passbackService.addAdSlot(adSlotDefinition);

      return Promise.all([
        postMessage(
          JSON.stringify({ type: 'passback', domId: 'foo', passbackOrigin: 'outstream-partner-1' })
        ),
        postMessage(
          JSON.stringify({ type: 'passback', domId: 'foo', passbackOrigin: 'outstream-partner-1' })
        )
      ]).then(() => {
        expect(pubadsRefreshSpy).to.have.be.calledOnce;
        expect(pubadsRefreshSpy).to.have.be.calledOnceWithExactly(
          Sinon.match.array.and(
            Sinon.match(adSlots => {
              return adSlots.length === 1 && adSlots[0].getSlotElementId() === 'foo';
            }, 'more or less than 1 ad slot used OR wrong slot')
          )
        );
      });
    });
  });

  describe('passback message with adUnitPath', () => {
    it('should not initialize the event listener if no ad slot is added', () => {
      const addEventListenerSpy = sandbox.spy(dom.window, 'addEventListener');
      new PassbackService(noopLogger, dom.window);
      expect(addEventListenerSpy).to.have.not.been.called;
    });

    it('should initialize the message listener only once', () => {
      const addEventListenerSpy = sandbox.spy(dom.window, 'addEventListener');
      const passbackService = new PassbackService(noopLogger, dom.window);

      passbackService.addAdSlot({
        moliSlot: { domId: 'foo', adUnitPath: '/1/foo' }
      } as any);

      passbackService.addAdSlot({
        moliSlot: { domId: 'bar', adUnitPath: '/1/bar' }
      } as any);

      expect(addEventListenerSpy).to.have.been.calledOnce;
      expect(addEventListenerSpy).to.have.been.calledOnceWith(
        Sinon.match.same('message'),
        Sinon.match.func
      );
    });

    it('should not refresh a slot when the adUnitPath does not match', () => {
      const passbackService = new PassbackService(noopLogger, dom.window);
      const googleAdSlot = googleAdSlotStub('/1/foo', 'foo');

      const googleAdSlotSetTargetingSpy = sandbox.spy(googleAdSlot, 'setTargeting');
      const adSlotDefinition: Moli.SlotDefinition<any> = {
        moliSlot: { domId: 'foo', adUnitPath: '/1/foo' } as any,
        adSlot: googleAdSlot,
        filterSupportedSizes: {} as any
      };

      passbackService.addAdSlot(adSlotDefinition);

      return postMessage(
        JSON.stringify({
          type: 'passback',
          adUnitPath: '/1/another-slot',
          passbackOrigin: 'outstream-partner-1'
        })
      ).then(() => {
        expect(pubadsRefreshSpy).to.have.not.been.called;
        expect(googleAdSlotSetTargetingSpy).to.have.not.been.called;
      });
    });

    it('should refresh a slot when the proper event is fired', () => {
      const passbackService = new PassbackService(noopLogger, dom.window);
      const googleAdSlot = googleAdSlotStub('/1/foo', 'foo');

      const googleAdSlotSetTargetingSpy = sandbox.spy(googleAdSlot, 'setTargeting');
      const adSlotDefinition: Moli.SlotDefinition<any> = {
        moliSlot: { domId: 'foo', adUnitPath: '/1/foo' } as any,
        adSlot: googleAdSlot,
        filterSupportedSizes: {} as any
      };

      passbackService.addAdSlot(adSlotDefinition);

      return postMessage(
        JSON.stringify({
          type: 'passback',
          adUnitPath: '/1/foo',
          passbackOrigin: 'outstream-partner-1'
        })
      ).then(() => {
        expect(pubadsRefreshSpy).to.have.be.calledOnce;
        expect(pubadsRefreshSpy).to.have.be.calledOnceWithExactly(
          Sinon.match.array.and(
            Sinon.match(adSlots => {
              return adSlots.length === 1 && adSlots[0].getSlotElementId() === 'foo';
            }, 'more or less than 1 ad slot used OR wrong slot')
          )
        );

        expect(googleAdSlotSetTargetingSpy).to.have.been.calledTwice;
        expect(googleAdSlotSetTargetingSpy.firstCall.args[0]).to.be.equals('passback');
        expect(googleAdSlotSetTargetingSpy.firstCall.args[1]).to.be.equals('true');
        expect(googleAdSlotSetTargetingSpy.secondCall.args[0]).to.be.equals('passbackOrigin');
        expect(googleAdSlotSetTargetingSpy.secondCall.args[1]).to.be.equals('outstream-partner-1');
      });
    });

    it('should allow passbacks only once', () => {
      const passbackService = new PassbackService(noopLogger, dom.window);
      const googleAdSlot = googleAdSlotStub('/1/foo', 'foo');

      const adSlotDefinition: Moli.SlotDefinition<any> = {
        moliSlot: { domId: 'foo', adUnitPath: '/1/foo' } as any,
        adSlot: googleAdSlot,
        filterSupportedSizes: {} as any
      };

      passbackService.addAdSlot(adSlotDefinition);

      return Promise.all([
        postMessage(
          JSON.stringify({
            type: 'passback',
            adUnitPath: '/1/foo',
            passbackOrigin: 'outstream-partner-1'
          })
        ),
        postMessage(
          JSON.stringify({
            type: 'passback',
            adUnitPath: '/1/foo',
            passbackOrigin: 'outstream-partner-1'
          })
        )
      ]).then(() => {
        expect(pubadsRefreshSpy).to.have.be.calledOnce;
        expect(pubadsRefreshSpy).to.have.be.calledOnceWithExactly(
          Sinon.match.array.and(
            Sinon.match(adSlots => {
              return adSlots.length === 1 && adSlots[0].getSlotElementId() === 'foo';
            }, 'more or less than 1 ad slot used OR wrong slot')
          )
        );
      });
    });
  });
});
