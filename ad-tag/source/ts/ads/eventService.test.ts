import { createDom } from '../stubs/browserEnvSetup';
import { noopLogger } from '../stubs/moliStubs';
import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SlotEventService } from './slotEventService';
import { Moli } from '../types/moli';
import EventTrigger = Moli.behaviour.EventTrigger;
import { googletag } from '../types/googletag';

// setup sinon-chai
use(sinonChai);

describe('EventService', () => {
  // create a fresh DOM for each test
  let dom = createDom();
  let jsDomWindow: Window & googletag.IGoogleTagWindow = dom.window as any;

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();
  const callbackSpy = sandbox.spy();

  const dispatchEvent = (event: string, source: Window | Document | HTMLElement) => {
    source.dispatchEvent(new dom.window.Event(event));
  };

  beforeEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('getOrCreate EventSource', () => {
    it('should create an event source on window', () => {
      const eventService = new SlotEventService(noopLogger);
      const permanent = false;
      const eventSource = eventService.getOrCreateEventSource(
        {
          name: 'event',
          event: 'ads',
          source: jsDomWindow
        },
        undefined,
        jsDomWindow
      );

      eventSource.addCallback({ callback: callbackSpy, permanent });
      dispatchEvent('ads', jsDomWindow);
      expect(callbackSpy).to.be.calledOnce;
    });

    it('should create an event source on document', () => {
      const eventService = new SlotEventService(noopLogger);
      const permanent = false;

      const eventSource = eventService.getOrCreateEventSource(
        {
          name: 'event',
          event: 'ads',
          source: dom.window.document
        },
        undefined,
        jsDomWindow
      );

      eventSource.addCallback({ callback: callbackSpy, permanent });
      dispatchEvent('ads', dom.window.document);
      expect(callbackSpy).to.be.calledOnce;
    });

    it('should create an event source on an element in the DOM', () => {
      const eventService = new SlotEventService(noopLogger);
      const permanent = false;

      const div = dom.window.document.createElement('div');
      div.id = 'myslot';
      dom.window.document.body.append(div);

      const eventSource = eventService.getOrCreateEventSource(
        {
          name: 'event',
          event: 'ads',
          source: '#myslot'
        },
        undefined,
        jsDomWindow
      );

      eventSource.addCallback({ callback: callbackSpy, permanent });
      dispatchEvent('ads', div);
      expect(callbackSpy).to.be.calledOnce;
    });

    it('should create an event source only once on window', () => {
      const eventService = new SlotEventService(noopLogger);
      const permanent = false;

      const windowTrigger: EventTrigger = {
        name: 'event',
        event: 'ads',
        source: jsDomWindow
      };

      const eventSource1 = eventService.getOrCreateEventSource(
        windowTrigger,
        undefined,
        jsDomWindow
      );
      const eventSource2 = eventService.getOrCreateEventSource(
        windowTrigger,
        undefined,
        jsDomWindow
      );
      expect(eventSource1).to.be.equal(eventSource2);

      eventSource1.addCallback({ callback: callbackSpy, permanent });
      eventSource2.addCallback({ callback: callbackSpy, permanent });
      dispatchEvent('ads', jsDomWindow);
      expect(callbackSpy).to.be.calledTwice;
    });

    it('should create an event source only once on document', () => {
      const eventService = new SlotEventService(noopLogger);
      const permanent = false;

      const documentWindow: EventTrigger = {
        name: 'event',
        event: 'ads',
        source: dom.window.document
      };

      const eventSource1 = eventService.getOrCreateEventSource(
        documentWindow,
        undefined,
        jsDomWindow
      );
      const eventSource2 = eventService.getOrCreateEventSource(
        documentWindow,
        undefined,
        jsDomWindow
      );
      expect(eventSource1).to.be.equal(eventSource2);

      eventSource1.addCallback({ callback: callbackSpy, permanent });
      eventSource2.addCallback({ callback: callbackSpy, permanent });
      dispatchEvent('ads', dom.window.document);
      expect(callbackSpy).to.be.calledTwice;
    });

    it('should create an event source only once on an element in the DOM', () => {
      const eventService = new SlotEventService(noopLogger);
      const permanent = false;

      const div = dom.window.document.createElement('div');
      div.id = 'myslot';
      dom.window.document.body.append(div);

      const elementTrigger: EventTrigger = {
        name: 'event',
        event: 'ads',
        source: '#myslot'
      };

      const eventSource1 = eventService.getOrCreateEventSource(
        elementTrigger,
        undefined,
        jsDomWindow
      );
      const eventSource2 = eventService.getOrCreateEventSource(
        elementTrigger,
        undefined,
        jsDomWindow
      );
      expect(eventSource1).to.be.equal(eventSource2);

      eventSource1.addCallback({ callback: callbackSpy, permanent });
      eventSource2.addCallback({ callback: callbackSpy, permanent });
      dispatchEvent('ads', div);
      expect(callbackSpy).to.be.calledTwice;
    });
  });

  describe('permanent and non-permanent callbacks', () => {
    it('should create an event source on window and attach a permanent callback', () => {
      const eventService = new SlotEventService(noopLogger);
      const eventSource = eventService.getOrCreateEventSource(
        {
          name: 'event',
          event: 'ads',
          source: jsDomWindow
        },
        undefined,
        jsDomWindow
      );

      eventSource.addCallback({ callback: callbackSpy, permanent: true });
      dispatchEvent('ads', jsDomWindow);
      dispatchEvent('ads', jsDomWindow);
      dispatchEvent('ads', jsDomWindow);
      expect(callbackSpy).to.be.calledThrice;
    });

    it('should create an event source on window and attach a non-permanent callback', () => {
      const eventService = new SlotEventService(noopLogger);
      const eventSource = eventService.getOrCreateEventSource(
        {
          name: 'event',
          event: 'ads',
          source: jsDomWindow
        },
        undefined,
        jsDomWindow
      );

      eventSource.addCallback({ callback: callbackSpy, permanent: false });
      dispatchEvent('ads', jsDomWindow);
      dispatchEvent('ads', jsDomWindow);
      dispatchEvent('ads', jsDomWindow);
      expect(callbackSpy).to.be.calledOnce;
    });
  });

  describe('remove all event sources', () => {
    it('should remove all event listeners', () => {
      const eventService = new SlotEventService(noopLogger);
      const permanent = true;

      const windowEventSource = eventService.getOrCreateEventSource(
        {
          name: 'event',
          event: 'ads',
          source: jsDomWindow
        },
        undefined,
        jsDomWindow
      );

      windowEventSource.addCallback({ callback: callbackSpy, permanent });
      const documentEventSource = eventService.getOrCreateEventSource(
        {
          name: 'event',
          event: 'ads',
          source: dom.window.document
        },
        undefined,
        jsDomWindow
      );

      documentEventSource.addCallback({ callback: callbackSpy, permanent });
      const div = dom.window.document.createElement('div');

      div.id = 'myslot';
      dom.window.document.body.append(div);
      const elementEventSource = eventService.getOrCreateEventSource(
        {
          name: 'event',
          event: 'ads',
          source: '#myslot'
        },
        undefined,
        jsDomWindow
      );

      elementEventSource.addCallback({ callback: callbackSpy, permanent });

      // dispatch first series of events
      dispatchEvent('ads', jsDomWindow);
      dispatchEvent('ads', dom.window.document);
      dispatchEvent('ads', div);
      expect(callbackSpy).to.have.been.calledThrice;

      // remove all event sources
      eventService.removeAllEventSources(jsDomWindow);

      // firing events should have no effect
      dispatchEvent('ads', jsDomWindow);
      dispatchEvent('ads', dom.window.document);
      dispatchEvent('ads', div);
      expect(callbackSpy).to.have.been.calledThrice;
    });
  });

  describe('remove event source', () => {
    it('should remove the event sources on window', () => {
      const eventService = new SlotEventService(noopLogger);
      const permanent = true;

      const trigger: EventTrigger = {
        name: 'event',
        event: 'ads',
        source: jsDomWindow
      };
      const windowEventSource = eventService.getOrCreateEventSource(
        trigger,
        undefined,
        jsDomWindow
      );

      windowEventSource.addCallback({ callback: callbackSpy, permanent });
      dispatchEvent('ads', jsDomWindow);
      eventService.removeEventSource(trigger, jsDomWindow);
      expect(callbackSpy).to.have.been.calledOnce;

      // has no effect
      dispatchEvent('ads', jsDomWindow);
      expect(callbackSpy).to.have.been.calledOnce;
    });

    it('should remove the event sources on document', () => {
      const eventService = new SlotEventService(noopLogger);
      const permanent = true;

      const trigger: EventTrigger = {
        name: 'event',
        event: 'ads',
        source: dom.window.document
      };
      const documentEventSource = eventService.getOrCreateEventSource(
        trigger,
        undefined,
        jsDomWindow
      );

      documentEventSource.addCallback({ callback: callbackSpy, permanent });
      dispatchEvent('ads', dom.window.document);
      eventService.removeEventSource(trigger, jsDomWindow);
      expect(callbackSpy).to.have.been.calledOnce;

      // has no effect
      dispatchEvent('ads', dom.window.document);
      expect(callbackSpy).to.have.been.calledOnce;
    });

    it('should remove the event sources on DOM node', () => {
      const eventService = new SlotEventService(noopLogger);
      const permanent = true;

      const div = dom.window.document.createElement('div');

      div.id = 'myslot';
      dom.window.document.body.append(div);

      const trigger: EventTrigger = {
        name: 'event',
        event: 'ads',
        source: '#myslot'
      };
      const elementEventSource = eventService.getOrCreateEventSource(
        trigger,
        undefined,
        jsDomWindow
      );

      elementEventSource.addCallback({ callback: callbackSpy, permanent });
      dispatchEvent('ads', div);
      eventService.removeEventSource(trigger, jsDomWindow);
      expect(callbackSpy).to.have.been.calledOnce;

      // has no effect
      dispatchEvent('ads', div);
      expect(callbackSpy).to.have.been.calledOnce;
    });
  });

  describe('throttling events', () => {
    it('should throttle events with 0s throttle duration', () => {
      const eventService = new SlotEventService(noopLogger);
      const permanent = true;
      const eventSource = eventService.getOrCreateEventSource(
        {
          name: 'event',
          event: 'ads',
          source: jsDomWindow
        },
        0,
        jsDomWindow
      );

      eventSource.addCallback({ callback: callbackSpy, permanent });
      dispatchEvent('ads', jsDomWindow);
      dispatchEvent('ads', jsDomWindow);
      expect(callbackSpy).to.be.calledTwice;
    });

    it('should discard events with 1s throttle duration', () => {
      const eventService = new SlotEventService(noopLogger);
      const permanent = true;
      const eventSource = eventService.getOrCreateEventSource(
        {
          name: 'event',
          event: 'ads',
          source: jsDomWindow
        },
        1,
        jsDomWindow
      );

      eventSource.addCallback({ callback: callbackSpy, permanent });
      dispatchEvent('ads', jsDomWindow);
      dispatchEvent('ads', jsDomWindow);
      expect(callbackSpy).to.be.calledOnce;
    });

    it('should throttle events with 0.01s throttle duration', done => {
      const eventService = new SlotEventService(noopLogger);
      const permanent = true;
      const eventSource = eventService.getOrCreateEventSource(
        {
          name: 'event',
          event: 'ads',
          source: jsDomWindow
        },
        0.01,
        jsDomWindow
      );

      eventSource.addCallback({ callback: callbackSpy, permanent });
      dispatchEvent('ads', jsDomWindow);
      dispatchEvent('ads', jsDomWindow);
      expect(callbackSpy).to.be.calledOnce;

      setTimeout(() => {
        dispatchEvent('ads', jsDomWindow);
        expect(callbackSpy).to.be.calledTwice;
        done();
      }, 10);
    });
  });
});
