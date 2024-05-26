import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import ISlotRenderEndedEvent = googletag.events.ISlotRenderEndedEvent;

import { AdReload } from './index';
import { googletag } from '../../../types/googletag';
import { createDom } from '../../../stubs/browserEnvSetup';
import { prebidjs } from '../../../types/prebidjs';
import { MoliRuntime } from '../../../types/moliRuntime';
import { AdPipelineContext } from '../../adPipeline';
import { emptyConfig, emptyRuntimeConfig, noopLogger } from '../../../stubs/moliStubs';
import { GlobalAuctionContext } from '../../globalAuctionContext';
import { AdSlot, behaviour, modules, MoliConfig } from '../../../types/moliConfig';
import { createGoogletagStub, googleAdSlotStub } from '../../../stubs/googletagStubs';
import { AdVisibilityService } from './adVisibilityService';

use(sinonChai);

describe('Moli Ad Reload Module', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window &
    googletag.IGoogleTagWindow &
    prebidjs.IPrebidjsWindow &
    MoliRuntime.MoliWindow = dom.window as any;

  const adPipelineContext = (config: MoliConfig): AdPipelineContext => {
    return {
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: noopLogger,
      config: config,
      runtimeConfig: emptyRuntimeConfig,
      window: jsDomWindow,
      // no service dependencies required
      labelConfigService: null as any,
      tcData: null as any,
      adUnitPathVariables: {},
      auction: new GlobalAuctionContext(jsDomWindow)
    };
  };

  const createAdReloadModule = (
    includeAdvertiserIds: Array<number> = [],
    includeOrderIds: Array<number> = [],
    includeYieldGroupIds: Array<number> = [],
    excludeOrderIds: Array<number> = [],
    excludeAdSlotDomIds: Array<string> = [],
    optimizeClsScoreDomIds: Array<string> = []
  ) => {
    const module = new AdReload();
    const moduleConfig: modules.adreload.AdReloadModuleConfig = {
      enabled: true,
      includeAdvertiserIds,
      includeOrderIds,
      includeYieldGroupIds,
      excludeOrderIds,
      excludeAdSlotDomIds,
      optimizeClsScoreDomIds
    };
    module.configure({ adReload: moduleConfig });
    const configureStep = module.configureSteps()[0];
    // this is awkward, but it works. Alternative would be to inject the service into the module via the constructor for tests
    return {
      module,
      moduleConfig,
      configureStep,
      adVisibilityService: (): AdVisibilityService => (module as any).adVisibilityService
    };
  };

  const testAdSlotDomId = 'foo';
  const testAdSlot: AdSlot = {
    domId: testAdSlotDomId,
    behaviour: {
      loaded: 'eager'
    }
  } as AdSlot;
  const testSlotMoliConfig: MoliConfig = { ...emptyConfig, slots: [testAdSlot] };

  let testGoogleSlot = googleAdSlotStub('/123/foo', 'foo');
  const testSlotRenderEndedEvent: ISlotRenderEndedEvent = {
    slot: testGoogleSlot,
    advertiserId: 1337,
    campaignId: 4711,
    isEmpty: false
  } as ISlotRenderEndedEvent;

  beforeEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    jsDomWindow.moli = {
      refreshAdSlot(domId: string | string[]): Promise<'queued' | 'refreshed'> {
        return Promise.resolve('refreshed');
      }
    } as MoliRuntime.MoliTag;
    jsDomWindow.googletag = createGoogletagStub();
    testGoogleSlot = googleAdSlotStub('/123/foo', 'foo');
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('initialize', () => {
    it("shouldn't initialize the ad reload in environment test", () => {
      const { module, moduleConfig } = createAdReloadModule();
      expect(module.isInitialized()).to.be.false;
      module.initialize(
        { ...adPipelineContext(emptyConfig), env: 'test' },
        moduleConfig,
        [],
        () => {
          return;
        }
      );
      expect(module.isInitialized()).to.be.false;
    });

    it('should not initialize the ad reload in environment production', () => {
      const { module, moduleConfig } = createAdReloadModule();
      expect(module.isInitialized()).to.be.false;
      module.initialize(adPipelineContext(emptyConfig), moduleConfig, [], () => {
        return;
      });
      expect(module.isInitialized()).to.be.true;
    });
  });

  it('should not return any pipeline steps if unconfigured', () => {
    const module = new AdReload();

    expect(module.initSteps()).to.be.empty;
    expect(module.configureSteps()).to.be.empty;
    expect(module.prepareRequestAdsSteps()).to.be.empty;
  });

  it('should not return any pipeline steps if disabled', () => {
    const module = new AdReload();
    module.configure({ adReload: { enabled: false } as modules.adreload.AdReloadModuleConfig });

    expect(module.initSteps()).to.be.empty;
    expect(module.configureSteps()).to.be.empty;
    expect(module.prepareRequestAdsSteps()).to.be.empty;
  });

  it('should return any init and configure steps if unconfigured', () => {
    const module = new AdReload();

    expect(module.initSteps()).to.be.empty;
    expect(module.configureSteps()).to.be.empty;
    expect(module.prepareRequestAdsSteps()).to.be.empty;
  });

  it('should setup the pubads slotRenderEnded listener for the slots (but only once)', async () => {
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');
    const { configureStep } = createAdReloadModule();

    await configureStep(adPipelineContext(emptyConfig), []);

    // one call is done by the ad-reload module, the other one by the AdVisibilityService
    expect(listenerSpy).to.have.been.calledTwice;
    expect(listenerSpy).to.have.been.calledWithMatch('slotRenderEnded');

    await configureStep(adPipelineContext(emptyConfig), []);

    // no further call to pubads().addEventListener
    expect(listenerSpy).to.have.been.calledTwice;
  });

  it('should call trackSlot on the AdVisibilityService', async () => {
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');
    const { module, configureStep, adVisibilityService } = createAdReloadModule([1337], [42]);

    await configureStep(adPipelineContext(testSlotMoliConfig), [testAdSlot]);

    expect(listenerSpy).to.have.been.calledWithMatch('slotRenderEnded', Sinon.match.func);

    const trackSlotSpy = sandbox.spy(adVisibilityService(), 'trackSlot');
    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown as (event: ISlotRenderEndedEvent) => void;

    slotRenderedCallback(testSlotRenderEndedEvent);
    expect(trackSlotSpy).to.have.been.called;
  });

  it('should NOT call trackSlot if the slot was rendered empty', async () => {
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');
    const { module, configureStep, adVisibilityService } = createAdReloadModule([1337], [42]);

    await configureStep(adPipelineContext(testSlotMoliConfig), [testAdSlot]);

    expect(listenerSpy).to.have.been.calledWithMatch('slotRenderEnded');

    const trackSlotSpy = sandbox.spy(adVisibilityService(), 'trackSlot');
    const slotRenderEndedEvent: ISlotRenderEndedEvent = {
      ...testSlotRenderEndedEvent,
      isEmpty: true
    };

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown as (event: ISlotRenderEndedEvent) => void;

    slotRenderedCallback(slotRenderEndedEvent);
    expect(trackSlotSpy).to.not.have.been.called;
  });

  it('should NOT call trackSlot if the order id is not in the includes', async () => {
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');
    const { module, configureStep, adVisibilityService } = createAdReloadModule([], [43]);

    await configureStep(adPipelineContext(testSlotMoliConfig), [testAdSlot]);

    expect(listenerSpy).to.have.been.calledWithMatch('slotRenderEnded');
    const trackSlotSpy = sandbox.spy(adVisibilityService(), 'trackSlot');

    const slotRenderEndedEvent: ISlotRenderEndedEvent = {
      ...testSlotRenderEndedEvent,
      campaignId: 42
    };

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown as (event: ISlotRenderEndedEvent) => void;

    slotRenderedCallback(slotRenderEndedEvent);
    expect(trackSlotSpy).to.not.have.been.called;
  });

  it('should NOT call trackSlot if the yieldGroup id is not in the includes', async () => {
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');
    const { module, configureStep, adVisibilityService } = createAdReloadModule([], [], []);

    await configureStep(adPipelineContext(testSlotMoliConfig), [testAdSlot]);

    expect(listenerSpy).to.have.been.calledWithMatch('slotRenderEnded');
    const trackSlotSpy = sandbox.spy(adVisibilityService(), 'trackSlot');

    const slotRenderEndedEvent: ISlotRenderEndedEvent = {
      ...testSlotRenderEndedEvent,
      advertiserId: 0,
      campaignId: 0,
      yieldGroupIds: [1337]
    };

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown as (event: ISlotRenderEndedEvent) => void;

    slotRenderedCallback(slotRenderEndedEvent);
    expect(trackSlotSpy).to.not.have.been.called;
  });

  it('should NOT call trackSlot if the order id is in the excludes', async () => {
    const excludedOrderId = 42;
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    const { module, configureStep, adVisibilityService } = createAdReloadModule(
      [1337],
      [],
      [],
      [excludedOrderId]
    );
    await configureStep(adPipelineContext(testSlotMoliConfig), [testAdSlot]);

    expect(listenerSpy).to.have.been.calledWithMatch('slotRenderEnded');
    const trackSlotSpy = sandbox.spy(adVisibilityService(), 'trackSlot');

    const slotRenderEndedEvent: ISlotRenderEndedEvent = {
      ...testSlotRenderEndedEvent,
      campaignId: excludedOrderId
    };

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown as (event: ISlotRenderEndedEvent) => void;

    slotRenderedCallback(slotRenderEndedEvent);
    expect(trackSlotSpy).to.not.have.been.called;
  });

  it('should NOT call trackSlot if the advertiser id is NOT in the includes', async () => {
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');
    const { module, configureStep, adVisibilityService } = createAdReloadModule([13388], []);

    await configureStep(adPipelineContext(testSlotMoliConfig), [testAdSlot]);
    expect(listenerSpy).to.have.been.calledWithMatch('slotRenderEnded');

    const trackSlotSpy = sandbox.spy(adVisibilityService(), 'trackSlot');

    const slotRenderEndedEvent: ISlotRenderEndedEvent = {
      ...testSlotRenderEndedEvent,
      advertiserId: 1337
    };

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown as (event: ISlotRenderEndedEvent) => void;

    slotRenderedCallback(slotRenderEndedEvent);
    expect(trackSlotSpy).to.not.have.been.called;
  });

  it('should NOT call trackSlot if the DOM id is in the excludes', async () => {
    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');
    const { module, configureStep, adVisibilityService } = createAdReloadModule(
      [1337],
      [42],
      [],
      [],
      ['foo']
    );

    await configureStep(adPipelineContext(testSlotMoliConfig), [testAdSlot]);

    expect(listenerSpy).to.have.been.calledWithMatch('slotRenderEnded');
    const trackSlotSpy = sandbox.spy(adVisibilityService(), 'trackSlot');

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown as (event: ISlotRenderEndedEvent) => void;

    slotRenderedCallback(testSlotRenderEndedEvent);
    expect(trackSlotSpy).to.not.have.been.called;
  });

  const loadingBehaviours: Array<behaviour.Manual | behaviour.Eager | behaviour.Backfill> = [
    { loaded: 'manual' },
    { loaded: 'eager' },
    { loaded: 'backfill' }
  ];

  loadingBehaviours.forEach(loadingBehaviour => {
    it(`should set googletag key/value native-ad-reload=true and call moli.refreshAdSlot when reloading a slot with behaviour ${loadingBehaviour.loaded}`, async () => {
      const { configureStep, adVisibilityService } = createAdReloadModule([1337], [4711]);
      const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

      const testAdSlotWithBehaviour: AdSlot = {
        domId: 'foo',
        behaviour: loadingBehaviour
      } as AdSlot;

      await configureStep(adPipelineContext({ ...emptyConfig, slots: [testAdSlotWithBehaviour] }), [
        testAdSlotWithBehaviour
      ]);

      const googleSlot = googleAdSlotStub('foo', 'foo');
      const setTargetingSpy = sandbox.spy(googleSlot, 'setTargeting');

      const trackSlotSpy = sandbox.spy(adVisibilityService(), 'trackSlot');
      const refreshAdSlotSpy = sandbox.spy(jsDomWindow.moli, 'refreshAdSlot');

      const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = listenerSpy.args.find(
        args => (args[0] as string) === 'slotRenderEnded'
      )?.[1] as unknown as (event: ISlotRenderEndedEvent) => void;

      slotRenderedCallback(testSlotRenderEndedEvent);

      expect(trackSlotSpy).to.have.been.called;

      const reloadCallback = trackSlotSpy.args[0][1] as (googleTagSlot: googletag.IAdSlot) => void;

      reloadCallback(googleSlot);

      expect(setTargetingSpy).to.have.been.calledOnceWithExactly('native-ad-reload', 'true');
      expect(refreshAdSlotSpy).to.have.been.calledOnceWithExactly(testAdSlotWithBehaviour.domId, {
        loaded: loadingBehaviour.loaded
      });
    });
  });

  it('should filter possible sizes to same or lower height when CLS optimization is enabled', async () => {
    const moliSlot: AdSlot = { ...testAdSlot, sizes: ['fluid', [300, 600], [300, 250]] };
    const { configureStep, adVisibilityService } = createAdReloadModule(
      [1337],
      [4711],
      [],
      [],
      [],
      [testAdSlotDomId]
    );

    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');
    const refreshAdSlotSpy = sandbox.spy(jsDomWindow.moli, 'refreshAdSlot');
    const setTargetingSpy = sandbox.spy(testGoogleSlot, 'setTargeting');
    const destroySlotSpy = sandbox.spy(dom.window.googletag, 'destroySlots');

    await configureStep(adPipelineContext({ ...emptyConfig, slots: [moliSlot] }), [moliSlot]);
    const trackSlotSpy = sandbox.spy(adVisibilityService(), 'trackSlot');

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown as (event: ISlotRenderEndedEvent) => void;

    slotRenderedCallback(testSlotRenderEndedEvent);

    expect(trackSlotSpy).to.have.been.called;

    const reloadCallback = trackSlotSpy.args[0][1] as (googleTagSlot: googletag.IAdSlot) => void;

    const styleSetPropertySpy = sandbox.spy();

    sandbox.stub(dom.window.document, 'getElementById').returns({
      scrollHeight: 250,
      style: { setProperty: styleSetPropertySpy as Function }
    } as HTMLElement);

    reloadCallback(testGoogleSlot);

    expect(styleSetPropertySpy).to.have.been.calledOnceWithExactly('height', '250px');
    expect(setTargetingSpy).to.have.been.calledOnceWithExactly('native-ad-reload', 'true');
    expect(destroySlotSpy).to.have.been.calledOnceWithExactly([testGoogleSlot]);

    // poof, 300x600 and "fluid" are gone
    expect(refreshAdSlotSpy).to.have.been.calledOnceWithExactly(moliSlot.domId, {
      loaded: testAdSlot.behaviour.loaded,
      sizesOverride: [[300, 250]]
    });
  });

  it("should NOT destroy the googleslot if possible sizes don't change when CLS optimization is enabled", async () => {
    const moliSlot: AdSlot = {
      ...testAdSlot,
      sizes: ['fluid', [300, 600], [300, 250]]
    };
    const { configureStep, adVisibilityService } = createAdReloadModule(
      [1337],
      [4711],
      [],
      [],
      [],
      [testAdSlotDomId]
    );

    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    await configureStep(adPipelineContext({ ...emptyConfig, slots: [moliSlot] }), [moliSlot]);

    const googleSlot = googleAdSlotStub('foo', 'foo');
    const setTargetingSpy = sandbox.spy(googleSlot, 'setTargeting');
    const destroySlotSpy = sandbox.spy(dom.window.googletag, 'destroySlots');

    const trackSlotSpy = sandbox.spy(adVisibilityService(), 'trackSlot');
    const refreshAdSlotSpy = sandbox.spy(jsDomWindow.moli, 'refreshAdSlot');

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown as (event: ISlotRenderEndedEvent) => void;

    slotRenderedCallback(testSlotRenderEndedEvent);

    expect(trackSlotSpy).to.have.been.called;

    const reloadCallback = trackSlotSpy.args[0][1] as (googleTagSlot: googletag.IAdSlot) => void;

    const styleSetPropertySpy = sandbox.spy();

    sandbox.stub(dom.window.document, 'getElementById').returns({
      scrollHeight: 600,
      style: { setProperty: styleSetPropertySpy as Function }
    } as HTMLElement);

    reloadCallback(googleSlot);

    expect(styleSetPropertySpy).to.have.been.calledOnceWithExactly('height', '600px');
    expect(setTargetingSpy).to.have.been.calledOnceWithExactly('native-ad-reload', 'true');

    // no destroying anything, sizes didn't change because the first impression already had 600px height
    expect(destroySlotSpy).to.not.have.been.called;

    // "fluid" size is out nevertheless because CLS optimization is enabled
    expect(refreshAdSlotSpy).to.have.been.calledOnceWithExactly(moliSlot.domId, {
      loaded: testAdSlot.behaviour.loaded,
      sizesOverride: [
        [300, 600],
        [300, 250]
      ]
    });
  });

  it('should remove visibility tracking if reloading is not allowed again', async () => {
    const { configureStep, adVisibilityService } = createAdReloadModule([1337], [4711]);

    const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

    await configureStep(adPipelineContext(testSlotMoliConfig), [testAdSlot]);

    const googleSlot = googleAdSlotStub('/123/foo', testAdSlotDomId);

    const setTargetingSpy = sandbox.spy(googleSlot, 'setTargeting');
    const trackSlotSpy = sandbox.spy(adVisibilityService(), 'trackSlot');
    const refreshAdSlotSpy = sandbox.spy(jsDomWindow.moli, 'refreshAdSlot');

    // advertiserId and campaignId not in includes
    const slotRenderEndedEvent = {
      ...testSlotRenderEndedEvent,
      slot: googleSlot,
      advertiserId: 4711,
      campaignId: 42
    };

    const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = listenerSpy.args.find(
      args => (args[0] as string) === 'slotRenderEnded'
    )?.[1] as unknown as (event: ISlotRenderEndedEvent) => void;

    // slot was already tracked from a previous run
    const slotTrackedStub = sandbox.stub(adVisibilityService(), 'isSlotTracked').returns(true);
    const removeSlotTrackingSpy = sandbox.spy(adVisibilityService(), 'removeSlotTracking');

    slotRenderedCallback(slotRenderEndedEvent);

    expect(trackSlotSpy).to.not.have.been.called;
    expect(setTargetingSpy).to.not.have.been.called;
    expect(refreshAdSlotSpy).to.not.have.been.called;

    expect(slotTrackedStub).to.have.been.calledOnceWithExactly(testAdSlot.domId);
    expect(removeSlotTrackingSpy).to.have.been.calledOnceWithExactly(googleSlot);
  });

  describe('include conditions', () => {
    type IncludesConfig = {
      test: string;
      includeAdvertiserIds: number[];
      includeOrderIds: number[];
      includeYieldGroupIds: number[];
    };

    const slotRenderEndedEvent = (googleSlot: googletag.IAdSlot): ISlotRenderEndedEvent =>
      ({
        slot: googleSlot,
        advertiserId: 1,
        campaignId: 2,
        yieldGroupIds: [3]
      } as ISlotRenderEndedEvent);

    const testCases: IncludesConfig[] = [
      {
        test: 'only advertiser id is included',
        includeAdvertiserIds: [1],
        includeOrderIds: [],
        includeYieldGroupIds: []
      },
      {
        test: 'only order id is included',
        includeAdvertiserIds: [],
        includeOrderIds: [2],
        includeYieldGroupIds: []
      },
      {
        test: 'only yieldGroup id is included',
        includeAdvertiserIds: [],
        includeOrderIds: [],
        includeYieldGroupIds: [3]
      },
      {
        test: 'advertiser id matches, but others dont',
        includeAdvertiserIds: [1],
        includeOrderIds: [22],
        includeYieldGroupIds: [33]
      },
      {
        test: 'yieldGroupId id matches, but others dont',
        includeAdvertiserIds: [11],
        includeOrderIds: [22],
        includeYieldGroupIds: [3]
      }
    ];

    testCases.forEach(({ test, includeAdvertiserIds, includeOrderIds, includeYieldGroupIds }) => {
      it(`should trackSlot if ${test}`, async () => {
        const { configureStep, adVisibilityService } = createAdReloadModule(
          includeAdvertiserIds,
          includeOrderIds,
          includeYieldGroupIds
        );
        const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

        await configureStep(adPipelineContext(testSlotMoliConfig), [testAdSlot]);

        const trackSlotSpy = sandbox.spy(adVisibilityService(), 'trackSlot');

        const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = listenerSpy.args.find(
          args => (args[0] as string) === 'slotRenderEnded'
        )?.[1] as unknown as (event: ISlotRenderEndedEvent) => void;

        slotRenderedCallback(slotRenderEndedEvent(testGoogleSlot));

        expect(trackSlotSpy).to.have.been.called;
      });
    });
  });
});
