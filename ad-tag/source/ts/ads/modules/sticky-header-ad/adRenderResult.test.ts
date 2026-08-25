import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { adRenderResult } from './renderResult';
import { createDom } from 'ad-tag/stubs/browserEnvSetup';
import { googletag } from 'ad-tag/types/googletag';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { createGoogletagStub, googleAdSlotStub } from 'ad-tag/stubs/googletagStubs';
import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import { AdSlot } from 'ad-tag/types/moliConfig';

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

  // resolved ad unit path of the header slot. On the `gam` channel this is the only way to
  // identify the out-of-page anchor slot, which never carries the domId (see ADR 0007).
  const headerAdUnitPath = '/123/sticky-header/mobile';

  const adPipelineContext = (): AdPipelineContext =>
    ({
      env__: 'production',
      window__: jsDomWindow
    }) as AdPipelineContext;

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    jsDomWindow.googletag = createGoogletagStub();
    eventListenerStub = sandbox.stub(jsDomWindow.googletag.pubads(), 'addEventListener');

    sandbox.reset();
    sandbox.resetHistory();
  });

  it('should resolve with standard if env is test', async () => {
    const ctx: AdPipelineContext = { ...adPipelineContext(), env__: 'test' };
    const headerSlot = {
      domId: domId
    } as AdSlot;
    const disallowedAdvertiserIds = [1];
    const minVisibleDuration = 0;

    const { adRenderResult } = await import('./renderResult');
    const result = await adRenderResult(
      ctx,
      headerSlot,
      disallowedAdvertiserIds,
      undefined,
      minVisibleDuration
    );

    expect(result).to.equal('standard');
  });

  it('should do nothing if the dom id differs', async () => {
    const headerSlot = {
      domId: domId
    } as AdSlot;
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
      undefined,
      minVisibleDuration
    );

    const resolved = await Promise.race([result, sleep]);

    expect(resolved).to.equal('unresolved');
  });

  it('should resolve with empty if event is empty', async () => {
    const headerSlot = {
      domId: domId
    } as AdSlot;
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
      undefined,
      minVisibleDuration
    );

    expect(result).to.equal('empty');
  });

  it('should resolve with disallowed if advertiser id is in disallowed list', async () => {
    const headerSlot = {
      domId: domId
    } as AdSlot;
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
      undefined,
      minVisibleDuration
    );

    expect(result).to.equal('disallowed');
  });

  it('should resolve with standard if advertiser id is not in disallowed list', async () => {
    const headerSlot = {
      domId: domId
    } as AdSlot;
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
      undefined,
      minVisibleDuration
    );

    expect(result).to.equal('standard');
  });

  it('should resolve with standard if minVisibleDuration is 0', async () => {
    const headerSlot = {
      domId: domId
    } as AdSlot;
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
      undefined,
      minVisibleDuration
    );

    expect(result).to.equal('standard');
  });

  it('should resolve with standard after minVisibleDuration', async () => {
    const setTimeSpy = sandbox.spy(jsDomWindow, 'setTimeout');
    const headerSlot = {
      domId: domId
    } as AdSlot;
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
      undefined,
      minVisibleDuration
    );

    expect(setTimeSpy).to.have.been.calledWith(Sinon.match.func, minVisibleDuration);
    expect(result).to.equal('standard');
  });

  it('should resolve with disallowed if channel is gam, matching the anchor slot by adUnitPath', async () => {
    const headerSlot = {
      domId: domId,
      adUnitPath: headerAdUnitPath
    } as AdSlot;
    const disallowedAdvertiserIds: number[] = [];
    const minVisibleDuration = 0;

    // on the `gam` channel the slot is defined via `defineOutOfPageSlot`, so GPT reports its own
    // auto-generated element id - never `domId`. Only the adUnitPath plus the TOP_ANCHOR format
    // targeting identify it.
    const anchorSlot = googleAdSlotStub(headerAdUnitPath, 'google_ads_iframe_top_anchor_0');
    anchorSlot.setTargeting('f', jsDomWindow.googletag.enums.OutOfPageFormat.TOP_ANCHOR.toString());

    resolveListenerWith({
      slot: anchorSlot,
      advertiserId: 2,
      isEmpty: false
    } as any);

    const result = await adRenderResult(
      adPipelineContext(),
      headerSlot,
      disallowedAdvertiserIds,
      'gam',
      minVisibleDuration
    );

    expect(result).to.equal('disallowed');
  });

  it('should ignore a stale gam anchor slot when the channel is c', async () => {
    const headerSlot = {
      domId: domId,
      adUnitPath: headerAdUnitPath
    } as AdSlot;
    const disallowedAdvertiserIds: number[] = [];
    const minVisibleDuration = 0;

    // a stale anchor slot from a previous cycle shares the adUnitPath and the anchor format
    // targeting. It must not be mistaken for this cycle's in-page slot.
    const staleAnchorSlot = googleAdSlotStub(headerAdUnitPath, 'google_ads_iframe_top_anchor_0');
    staleAnchorSlot.setTargeting(
      'f',
      jsDomWindow.googletag.enums.OutOfPageFormat.TOP_ANCHOR.toString()
    );

    resolveListenerWith({
      slot: staleAnchorSlot,
      isEmpty: true
    } as any);

    // wait a little bit to show that the promise will never be resolved by the stale slot
    const sleep = new Promise<'unresolved'>(resolve =>
      setTimeout(() => resolve('unresolved'), 250)
    );

    const result = adRenderResult(
      adPipelineContext(),
      headerSlot,
      disallowedAdvertiserIds,
      'c',
      minVisibleDuration
    );

    expect(await Promise.race([result, sleep])).to.equal('unresolved');
  });

  it('should resolve with standard if channel is c and advertiser is not disallowed', async () => {
    const headerSlot = {
      domId: domId
    } as AdSlot;
    const disallowedAdvertiserIds: number[] = [];
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
      'c',
      minVisibleDuration
    );

    expect(result).to.equal('standard');
  });
});
