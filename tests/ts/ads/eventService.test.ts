import { createDom } from '../stubs/browserEnvSetup';
import { noopLogger } from '../stubs/moliStubs';
import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { SlotEventService } from '../../../source/ts/ads/slotEventService';
import { Moli } from '../../../source/ts';
import EventTrigger = Moli.behaviour.EventTrigger;


// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('EventService', () => {

  // create a fresh DOM for each test
  let dom = createDom();

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();
  const callbackSpy = sandbox.spy();

  const dispatchEvent = (event: string, source: Window | Document | HTMLElement) => {
    source.dispatchEvent(new dom.window.Event(event));
  };

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('getOrCreate EventSource', () => {

    it('should create an event source on window', () => {
      const eventService = new SlotEventService(noopLogger);
      const eventSource = eventService.getOrCreateEventSource({
        name: 'event',
        event: 'ads',
        source: dom.window
      }, dom.window);

      eventSource.setCallback(callbackSpy);
      dispatchEvent('ads', dom.window);
      expect(callbackSpy).to.be.calledOnce;
    });

    it('should create an event source on document', () => {
      const eventService = new SlotEventService(noopLogger);

      const eventSource = eventService.getOrCreateEventSource({
        name: 'event',
        event: 'ads',
        source: dom.window.document
      }, dom.window);

      eventSource.setCallback(callbackSpy);
      dispatchEvent('ads', dom.window.document);
      expect(callbackSpy).to.be.calledOnce;
    });

    it('should create an event source on an element in the DOM', () => {
      const eventService = new SlotEventService(noopLogger);

      const div = dom.window.document.createElement('div');
      div.id = 'myslot';
      dom.window.document.body.append(div);

      const eventSource = eventService.getOrCreateEventSource({
        name: 'event',
        event: 'ads',
        source: '#myslot'
      }, dom.window);

      eventSource.setCallback(callbackSpy);
      dispatchEvent('ads', div);
      expect(callbackSpy).to.be.calledOnce;
    });

    it('should create an event source only once on window', () => {
      const eventService = new SlotEventService(noopLogger);

      const windowTrigger: EventTrigger = {
        name: 'event',
        event: 'ads',
        source: dom.window
      };

      const eventSource1 = eventService.getOrCreateEventSource(windowTrigger, dom.window);
      const eventSource2 = eventService.getOrCreateEventSource(windowTrigger, dom.window);
      expect(eventSource1).to.be.equal(eventSource2);

      eventSource1.setCallback(callbackSpy);
      eventSource2.setCallback(callbackSpy);
      dispatchEvent('ads', dom.window);
      expect(callbackSpy).to.be.calledOnce;
    });

    it('should create an event source only once on document', () => {
      const eventService = new SlotEventService(noopLogger);

      const documentWindow: EventTrigger = {
        name: 'event',
        event: 'ads',
        source: dom.window.document
      };

      const eventSource1 = eventService.getOrCreateEventSource(documentWindow, dom.window);
      const eventSource2 = eventService.getOrCreateEventSource(documentWindow, dom.window);
      expect(eventSource1).to.be.equal(eventSource2);

      eventSource1.setCallback(callbackSpy);
      eventSource2.setCallback(callbackSpy);
      dispatchEvent('ads', dom.window.document);
      expect(callbackSpy).to.be.calledOnce;
    });

    it('should create an event source only once on an element in the DOM', () => {
      const eventService = new SlotEventService(noopLogger);

      const div = dom.window.document.createElement('div');
      div.id = 'myslot';
      dom.window.document.body.append(div);

      const elementTrigger: EventTrigger = {
        name: 'event',
        event: 'ads',
        source: '#myslot'
      };

      const eventSource1 = eventService.getOrCreateEventSource(elementTrigger, dom.window);
      const eventSource2 = eventService.getOrCreateEventSource(elementTrigger, dom.window);
      expect(eventSource1).to.be.equal(eventSource2);

      eventSource1.setCallback(callbackSpy);
      eventSource2.setCallback(callbackSpy);
      dispatchEvent('ads', div);
      expect(callbackSpy).to.be.calledOnce;
    });

  });

  describe('remove all event sources', () => {
    it('should remove all event listeners', () => {
      const eventService = new SlotEventService(noopLogger);

      const windowEventSource = eventService.getOrCreateEventSource({
        name: 'event',
        event: 'ads',
        source: dom.window
      }, dom.window);

      windowEventSource.setCallback(callbackSpy);
      const documentEventSource = eventService.getOrCreateEventSource({
        name: 'event',
        event: 'ads',
        source: dom.window.document
      }, dom.window);

      documentEventSource.setCallback(callbackSpy);
      const div = dom.window.document.createElement('div');

      div.id = 'myslot';
      dom.window.document.body.append(div);
      const elementEventSource = eventService.getOrCreateEventSource({
        name: 'event',
        event: 'ads',
        source: '#myslot'
      }, dom.window);

      elementEventSource.setCallback(callbackSpy);

      // dispatch first series of events
      dispatchEvent('ads', dom.window);
      dispatchEvent('ads', dom.window.document);
      dispatchEvent('ads', div);
      expect(callbackSpy).to.have.been.calledThrice;

      // remove all event sources
      eventService.removeAllEventSources(dom.window);

      // firing events should have no effect
      dispatchEvent('ads', dom.window);
      dispatchEvent('ads', dom.window.document);
      dispatchEvent('ads', div);
      expect(callbackSpy).to.have.been.calledThrice;
    });
  });

  describe('remove event source', () => {
    it('should remove the event sources on window', () => {
      const eventService = new SlotEventService(noopLogger);

      const trigger: EventTrigger = {
        name: 'event',
        event: 'ads',
        source: dom.window
      };
      const windowEventSource = eventService.getOrCreateEventSource(trigger, dom.window);

      windowEventSource.setCallback(callbackSpy);
      dispatchEvent('ads', dom.window);
      eventService.removeEventSource(trigger, dom.window);
      expect(callbackSpy).to.have.been.calledOnce;

      // has no effect
      dispatchEvent('ads', dom.window);
      expect(callbackSpy).to.have.been.calledOnce;
    });

    it('should remove the event sources on document', () => {
      const eventService = new SlotEventService(noopLogger);

      const trigger: EventTrigger = {
        name: 'event',
        event: 'ads',
        source: dom.window.document
      };
      const documentEventSource = eventService.getOrCreateEventSource(trigger, dom.window);

      documentEventSource.setCallback(callbackSpy);
      dispatchEvent('ads', dom.window.document);
      eventService.removeEventSource(trigger, dom.window);
      expect(callbackSpy).to.have.been.calledOnce;

      // has no effect
      dispatchEvent('ads', dom.window.document);
      expect(callbackSpy).to.have.been.calledOnce;
    });

    it('should remove the event sources on DOM node', () => {
      const eventService = new SlotEventService(noopLogger);

      const div = dom.window.document.createElement('div');

      div.id = 'myslot';
      dom.window.document.body.append(div);

      const trigger: EventTrigger = {
        name: 'event',
        event: 'ads',
        source: '#myslot'
      };
      const elementEventSource = eventService.getOrCreateEventSource(trigger, dom.window);

      elementEventSource.setCallback(callbackSpy);
      dispatchEvent('ads', div);
      eventService.removeEventSource(trigger, dom.window);
      expect(callbackSpy).to.have.been.calledOnce;

      // has no effect
      dispatchEvent('ads', div);
      expect(callbackSpy).to.have.been.calledOnce;
    });
  });

});
