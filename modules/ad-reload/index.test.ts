import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

import { createDom } from '@highfivve/ad-tag/lib/tests/ts/stubs/browserEnvSetup';
import {
  createGoogletagStub,
  googleAdSlotStub
} from '@highfivve/ad-tag/lib/tests/ts/stubs/googletagStubs';
import { reportingServiceStub } from '@highfivve/ad-tag/lib/tests/ts/stubs/reportingServiceStub';
import { noopLogger } from '@highfivve/ad-tag/lib/tests/ts/stubs/moliStubs';

import {
  AdPipeline,
  AdPipelineContext,
  createAssetLoaderService,
  googletag,
  IAdPipelineConfiguration,
  mkInitStep,
  Moli
} from '@highfivve/ad-tag';
import ISlotRenderEndedEvent = googletag.events.ISlotRenderEndedEvent;

import AdReload from './index';
import { SlotEventService } from '@highfivve/ad-tag/lib/source/ts/ads/slotEventService';

use(sinonChai);

// tslint:disable: no-unused-expression
describe('Moli Ad Reload Module', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window = dom.window as any;

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const reportingService = reportingServiceStub();
  const slotEventService = new SlotEventService(noopLogger);
  const emptyPipelineConfig: IAdPipelineConfiguration = {
    init: [],
    configure: [],
    defineSlots: () => Promise.resolve([]),
    prepareRequestAds: [],
    requestBids: [],
    requestAds: () => Promise.resolve()
  };
  const adPipelineContext = (config: Moli.MoliConfig): AdPipelineContext => {
    return {
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: noopLogger,
      config: config,
      window: jsDomWindow,
      // no service dependencies required
      labelConfigService: null as any,
      reportingService: null as any,
      slotEventService: null as any
    };
  };

  beforeEach(() => {
    jsDomWindow.googletag = createGoogletagStub();
  });

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    sandbox.reset();
  });

  const createAdReloadModule = (
    reloadKeyValue: string = 'foo-reload',
    includeAdvertiserIds: Array<number> = [],
    includeOrderIds: Array<number> = [],
    excludeOrderIds: Array<number> = [],
    excludeAdSlotDomIds: Array<string> = [],
    window: Window = jsDomWindow
  ): AdReload => {
    return new AdReload(
      {
        includeAdvertiserIds,
        includeOrderIds,
        excludeOrderIds,
        excludeAdSlotDomIds
      },
      window,
      reloadKeyValue
    );
  };

  const initModule = (module: AdReload, configPipeline?: Moli.pipeline.PipelineConfig) => {
    const moliSlot = { domId: 'foo' } as Moli.AdSlot;

    const moliConfig: Moli.MoliConfig = {
      slots: [moliSlot],
      yieldOptimization: { provider: 'none' },
      pipeline: configPipeline,
      logger: noopLogger
    };

    const adPipeline = new AdPipeline(
      emptyPipelineConfig,
      noopLogger,
      jsDomWindow,
      reportingService,
      slotEventService
    );

    module.init(moliConfig, assetLoaderService, () => adPipeline);

    return { moliConfig, adPipeline };
  };

  it("shouldn't overwrite the config's pipeline if it already has one", () => {
    const module = createAdReloadModule();

    const configPipeline = {
      initSteps: [mkInitStep('stub', _ => Promise.resolve())],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    const { moliConfig } = initModule(module, configPipeline);

    expect(moliConfig.pipeline).to.be.ok;

    // initialization adds one configureStep and one prepareRequestAdsStep
    expect(moliConfig.pipeline?.initSteps).to.have.lengthOf(1);
    expect(moliConfig.pipeline?.configureSteps).to.have.lengthOf(1);
    expect(moliConfig.pipeline?.prepareRequestAdsSteps).to.have.lengthOf(0);
  });

  it('should setup the pubads slotRenderEnded listener for the slots (but only once)', async () => {
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');
    const module = createAdReloadModule();

    const { moliConfig } = initModule(module);

    expect(moliConfig.pipeline).to.be.ok;
    expect(moliConfig.pipeline?.configureSteps).to.have.lengthOf(1);

    await moliConfig.pipeline?.configureSteps[0](adPipelineContext(moliConfig), []);

    // one call is done by the ad-reload module, the other one by the AdVisibilityService
    expect(listenerSpy).to.have.been.calledTwice;
    expect(listenerSpy).to.have.been.calledWithMatch('slotRenderEnded');

    await moliConfig.pipeline?.configureSteps[0](adPipelineContext(moliConfig), []);

    // no further call to pubads().addEventListener
    expect(listenerSpy).to.have.been.calledTwice;
  });

  it('should call trackSlot on the AdVisibilityService', async () => {
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    const module = createAdReloadModule('foo-reload', [1337], [42]);
    const { moliConfig } = initModule(module);

    await moliConfig.pipeline?.configureSteps[0](adPipelineContext(moliConfig), [
      { domId: 'foo' } as Moli.AdSlot
    ]);

    expect(listenerSpy).to.have.been.calledWithMatch('slotRenderEnded');

    const trackSlotSpy = sandbox.spy((module as any).adVisibilityService, 'trackSlot');

    const slotRenderEndedEvent: ISlotRenderEndedEvent = {
      slot: { getSlotElementId: () => 'foo' } as googletag.IAdSlot,
      advertiserId: 1337,
      campaignId: 42
    } as ISlotRenderEndedEvent;

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = (listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown) as (event: ISlotRenderEndedEvent) => void;

    slotRenderedCallback(slotRenderEndedEvent);

    expect(trackSlotSpy).to.have.been.called;
  });

  it('should NOT call trackSlot if the slot was rendered empty', async () => {
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    const module = createAdReloadModule('foo-reload', [1337], [42]);
    const { moliConfig } = initModule(module);

    await moliConfig.pipeline?.configureSteps[0](adPipelineContext(moliConfig), [
      { domId: 'foo' } as Moli.AdSlot
    ]);

    expect(listenerSpy).to.have.been.calledWithMatch('slotRenderEnded');

    const trackSlotSpy = sandbox.spy((module as any).adVisibilityService, 'trackSlot');

    const slotRenderEndedEvent: ISlotRenderEndedEvent = {
      slot: { getSlotElementId: () => 'foo' } as googletag.IAdSlot,
      advertiserId: 1337,
      campaignId: 42,
      isEmpty: true
    } as ISlotRenderEndedEvent;

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = (listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown) as (event: ISlotRenderEndedEvent) => void;

    slotRenderedCallback(slotRenderEndedEvent);

    expect(trackSlotSpy).to.not.have.been.called;
  });

  it('should NOT call trackSlot if the order id is not in the includes', async () => {
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    const module = createAdReloadModule('foo-reload', [], [43]);
    const { moliConfig } = initModule(module);

    await moliConfig.pipeline?.configureSteps[0](adPipelineContext(moliConfig), [
      { domId: 'foo' } as Moli.AdSlot
    ]);

    expect(listenerSpy).to.have.been.calledWithMatch('slotRenderEnded');

    const trackSlotSpy = sandbox.spy((module as any).adVisibilityService, 'trackSlot');

    const slotRenderEndedEvent: ISlotRenderEndedEvent = {
      slot: { getSlotElementId: () => 'foo' } as googletag.IAdSlot,
      advertiserId: 1337,
      campaignId: 42
    } as ISlotRenderEndedEvent;

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = (listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown) as (event: ISlotRenderEndedEvent) => void;

    slotRenderedCallback(slotRenderEndedEvent);

    expect(trackSlotSpy).to.not.have.been.called;
  });

  it('should NOT call trackSlot if the order id is in the excludes', async () => {
    const excludedOrderId = 42;
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    const module = createAdReloadModule('foo-reload', [1337], [], [excludedOrderId]);
    const { moliConfig } = initModule(module);

    await moliConfig.pipeline?.configureSteps[0](adPipelineContext(moliConfig), [
      { domId: 'foo' } as Moli.AdSlot
    ]);

    expect(listenerSpy).to.have.been.calledWithMatch('slotRenderEnded');

    const trackSlotSpy = sandbox.spy((module as any).adVisibilityService, 'trackSlot');

    const slotRenderEndedEvent: ISlotRenderEndedEvent = {
      slot: { getSlotElementId: () => 'foo' } as googletag.IAdSlot,
      advertiserId: 1337,
      campaignId: excludedOrderId
    } as ISlotRenderEndedEvent;

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = (listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown) as (event: ISlotRenderEndedEvent) => void;

    slotRenderedCallback(slotRenderEndedEvent);

    expect(trackSlotSpy).to.not.have.been.called;
  });

  it('should NOT call trackSlot if the advertiser id is NOT in the includes', async () => {
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    const module = createAdReloadModule('foo-reload', [1338], []);
    const { moliConfig } = initModule(module);

    await moliConfig.pipeline?.configureSteps[0](adPipelineContext(moliConfig), [
      { domId: 'foo' } as Moli.AdSlot
    ]);

    expect(listenerSpy).to.have.been.calledWithMatch('slotRenderEnded');

    const trackSlotSpy = sandbox.spy((module as any).adVisibilityService, 'trackSlot');

    const slotRenderEndedEvent: ISlotRenderEndedEvent = {
      slot: { getSlotElementId: () => 'foo' } as googletag.IAdSlot,
      advertiserId: 1337,
      campaignId: 42
    } as ISlotRenderEndedEvent;

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = (listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown) as (event: ISlotRenderEndedEvent) => void;

    slotRenderedCallback(slotRenderEndedEvent);

    expect(trackSlotSpy).to.not.have.been.called;
  });

  it('should NOT call trackSlot if the DOM id is in the excludes', async () => {
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    const module = createAdReloadModule('foo-reload', [1337], [42], [], ['foo']);
    const { moliConfig } = initModule(module);

    await moliConfig.pipeline?.configureSteps[0](adPipelineContext(moliConfig), [
      { domId: 'foo' } as Moli.AdSlot
    ]);

    expect(listenerSpy).to.have.been.calledWithMatch('slotRenderEnded');

    const trackSlotSpy = sandbox.spy((module as any).adVisibilityService, 'trackSlot');

    const slotRenderEndedEvent: ISlotRenderEndedEvent = {
      slot: { getSlotElementId: () => 'foo' } as googletag.IAdSlot,
      advertiserId: 1337,
      campaignId: 42
    } as ISlotRenderEndedEvent;

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = (listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown) as (event: ISlotRenderEndedEvent) => void;

    slotRenderedCallback(slotRenderEndedEvent);

    expect(trackSlotSpy).to.not.have.been.called;
  });

  it('should set googletag key/value foo-reload=true and run the ad pipeline when reloading a slot', async () => {
    const moliSlot = { domId: 'foo' } as Moli.AdSlot;
    const module = createAdReloadModule('foo-reload', [1337], [4711]);
    const { moliConfig, adPipeline } = initModule(module);

    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    await moliConfig.pipeline?.configureSteps[0](adPipelineContext(moliConfig), [moliSlot]);

    const googleSlot = googleAdSlotStub('foo', 'foo');
    const setTargetingSpy = sandbox.spy(googleSlot, 'setTargeting');

    const trackSlotSpy = sandbox.spy((module as any).adVisibilityService, 'trackSlot');
    const adPipelineRunSpy = sandbox.spy(adPipeline, 'run');

    const slotRenderEndedEvent: ISlotRenderEndedEvent = {
      slot: googleSlot,
      advertiserId: 1337,
      campaignId: 4711
    } as ISlotRenderEndedEvent;

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = (listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown) as (event: ISlotRenderEndedEvent) => void;

    slotRenderedCallback(slotRenderEndedEvent);

    expect(trackSlotSpy).to.have.been.called;

    const reloadCallback = trackSlotSpy.args[0][1] as (googleTagSlot: googletag.IAdSlot) => void;

    reloadCallback(googleSlot);

    expect(setTargetingSpy).to.have.been.calledOnceWithExactly('foo-reload', 'true');

    expect(adPipelineRunSpy).to.have.been.calledOnceWithExactly([moliSlot], moliConfig, 1);
  });

  it('should remove visibility tracking if reloading is not allowed again', async () => {
    const moliSlot = { domId: 'foo' } as Moli.AdSlot;
    const module = createAdReloadModule('foo-reload', [1337], [4711]);
    const { moliConfig, adPipeline } = initModule(module);

    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    await moliConfig.pipeline?.configureSteps[0](adPipelineContext(moliConfig), [moliSlot]);

    const googleSlot = googleAdSlotStub('foo', 'foo');
    const setTargetingSpy = sandbox.spy(googleSlot, 'setTargeting');
    const trackSlotSpy = sandbox.spy((module as any).adVisibilityService, 'trackSlot');
    const adPipelineRunSpy = sandbox.spy(adPipeline, 'run');

    // advertiserId and campaignId not in includes
    const slotRenderEndedEvent: ISlotRenderEndedEvent = {
      slot: googleSlot,
      advertiserId: 4711,
      campaignId: 42
    } as ISlotRenderEndedEvent;

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = (listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown) as (event: ISlotRenderEndedEvent) => void;

    // slot was already tracked from a previous run
    const slotTrackedStub = sandbox
      .stub((module as any).adVisibilityService, 'isSlotTracked')
      .returns(true);
    const removeSlotTrackingSpy = sandbox.spy(
      (module as any).adVisibilityService,
      'removeSlotTracking'
    );

    slotRenderedCallback(slotRenderEndedEvent);

    expect(trackSlotSpy).to.not.have.been.called;
    expect(setTargetingSpy).to.not.have.been.called;
    expect(adPipelineRunSpy).to.not.have.been.called;

    expect(slotTrackedStub).to.have.been.calledOnceWithExactly(moliSlot.domId);
    expect(removeSlotTrackingSpy).to.have.been.calledOnceWithExactly(googleSlot);
  });
});
