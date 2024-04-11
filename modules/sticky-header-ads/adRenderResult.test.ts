import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import { AdPipelineContext, googletag, Moli, prebidjs } from '@highfivve/ad-tag';
import { createGoogletagStub } from '@highfivve/ad-tag/lib/stubs/googletagStubs';

import { adRenderResult } from './renderResult';

// setup sinon-chai
use(sinonChai);

describe('renderResult', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow =
    dom.window as any;
  jsDomWindow.googletag = createGoogletagStub();

  let eventListenerStub = sandbox.stub(jsDomWindow.googletag.pubads(), 'addEventListener');

  const resolveListenerWith = (event: googletag.events.ISlotRenderEndedEvent) => {
    eventListenerStub.callsFake((eventName, listener) => {
      (listener as any)(event);
      return jsDomWindow.googletag.pubads();
    });
  };

  const domId = 'header';

  const adPipelineContext = (): AdPipelineContext =>
    ({
      env: 'production',
      window: jsDomWindow
    } as AdPipelineContext);

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    jsDomWindow.googletag = createGoogletagStub();
    eventListenerStub = sandbox.stub(jsDomWindow.googletag.pubads(), 'addEventListener');

    sandbox.reset();
    sandbox.resetHistory();
  });

  it('should resolve with standard if env is test', async () => {
    const ctx: AdPipelineContext = { ...adPipelineContext(), env: 'test' };
    const headerSlot = {
      domId: domId
    } as Moli.AdSlot;
    const disallowedAdvertiserIds = [1];
    const minVisibleDuration = 0;

    const { adRenderResult } = await import('./renderResult');
    const result = await adRenderResult(
      ctx,
      headerSlot,
      disallowedAdvertiserIds,
      minVisibleDuration
    );

    expect(result).to.equal('standard');
  });

  it('should do nothing if the dom id differs', async () => {
    const headerSlot = {
      domId: domId
    } as Moli.AdSlot;
    const disallowedAdvertiserIds = [1];
    const minVisibleDuration = 0;

    resolveListenerWith({
      slot: {
        getSlotElementId: () => 'different'
      }
    } as any);

    // wait a little bit to show that the other promise will be never resolved
    const sleep = new Promise<'unresolved'>(resolve =>
      setTimeout(() => resolve('unresolved'), 250)
    );

    const result = adRenderResult(
      adPipelineContext(),
      headerSlot,
      disallowedAdvertiserIds,
      minVisibleDuration
    );

    const resolved = await Promise.race([result, sleep]);

    expect(resolved).to.equal('unresolved');
  });

  it('should resolve with empty if event is empty', async () => {
    const headerSlot = {
      domId: domId
    } as Moli.AdSlot;
    const disallowedAdvertiserIds = [1];
    const minVisibleDuration = 0;

    resolveListenerWith({
      slot: {
        getSlotElementId: () => domId
      },
      isEmpty: true
    } as any);

    const result = await adRenderResult(
      adPipelineContext(),
      headerSlot,
      disallowedAdvertiserIds,
      minVisibleDuration
    );

    expect(result).to.equal('empty');
  });

  it('should resolve with disallowed if advertiser id is in disallowed list', async () => {
    const headerSlot = {
      domId: domId
    } as Moli.AdSlot;
    const disallowedAdvertiserIds = [1];
    const minVisibleDuration = 0;

    resolveListenerWith({
      slot: {
        getSlotElementId: () => domId
      },
      advertiserId: 1
    } as any);

    const result = await adRenderResult(
      adPipelineContext(),
      headerSlot,
      disallowedAdvertiserIds,
      minVisibleDuration
    );

    expect(result).to.equal('disallowed');
  });

  it('should resolve with standard if advertiser id is not in disallowed list', async () => {
    const headerSlot = {
      domId: domId
    } as Moli.AdSlot;
    const disallowedAdvertiserIds = [1];
    const minVisibleDuration = 0;

    resolveListenerWith({
      slot: {
        getSlotElementId: () => domId
      },
      advertiserId: 2
    } as any);

    const result = await adRenderResult(
      adPipelineContext(),
      headerSlot,
      disallowedAdvertiserIds,
      minVisibleDuration
    );

    expect(result).to.equal('standard');
  });

  it('should resolve with standard if minVisibleDuration is 0', async () => {
    const headerSlot = {
      domId: domId
    } as Moli.AdSlot;
    const disallowedAdvertiserIds = [1];
    const minVisibleDuration = 0;

    resolveListenerWith({
      slot: {
        getSlotElementId: () => domId
      },
      advertiserId: 2
    } as any);

    const result = await adRenderResult(
      adPipelineContext(),
      headerSlot,
      disallowedAdvertiserIds,
      minVisibleDuration
    );

    expect(result).to.equal('standard');
  });

  it('should resolve with standard after minVisibleDuration', async () => {
    const setTimeSpy = sandbox.spy(jsDomWindow, 'setTimeout');
    const headerSlot = {
      domId: domId
    } as Moli.AdSlot;
    const disallowedAdvertiserIds = [1];
    const minVisibleDuration = 100;

    resolveListenerWith({
      slot: {
        getSlotElementId: () => domId
      },
      advertiserId: 2
    } as any);

    const result = await adRenderResult(
      adPipelineContext(),
      headerSlot,
      disallowedAdvertiserIds,
      minVisibleDuration
    );

    expect(setTimeSpy).to.have.been.calledWith(Sinon.match.func, minVisibleDuration);
    expect(result).to.equal('standard');
  });
});
