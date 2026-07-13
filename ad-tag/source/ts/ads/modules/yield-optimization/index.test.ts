import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { YieldOptimization } from './index';
import {
  createYieldOptimizationService,
  YieldOptimizationService
} from './yieldOptimizationService';
import { AdSlot, behaviour, modules, MoliConfig } from 'ad-tag/types/moliConfig';
import {
  emptyConfig,
  newAdPipelineContext,
  newNoopLogger,
  noopLogger
} from 'ad-tag/stubs/moliStubs';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { createGoogletagStub, googleAdSlotStub } from 'ad-tag/stubs/googletagStubs';
import { googletag } from 'ad-tag/types/googletag';
import ISlotRenderEndedEvent = googletag.events.ISlotRenderEndedEvent;

// setup sinon-chai
use(sinonChai);

describe('Yield Optimization module', () => {
  const sandbox = Sinon.createSandbox();
  let { jsDomWindow } = createDomAndWindow();
  jsDomWindow.googletag = createGoogletagStub();

  const adUnitId = 'adUnit1';
  const yieldConfig: modules.yield_optimization.StaticYieldOptimizationConfig = {
    enabled: true,
    provider: 'static',
    config: {
      rules: {
        [adUnitId]: {
          priceRuleId: 1,
          floorprice: 0.2,
          main: true
        }
      }
    }
  };

  const adUnit = (adUnitPath: string, labelAll: string[]): AdSlot => {
    return {
      domId: 'domId',
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      adUnitPath,
      labelAll,
      sizes: [],
      sizeConfig: []
    };
  };

  const uprReset: modules.yield_optimization.UprResetConfig = {
    excludeAdSlotDomIds: []
  };

  const yieldConfigWithUprReset = (
    uprResetConfig: modules.yield_optimization.UprResetConfig
  ): modules.yield_optimization.StaticYieldOptimizationConfig => ({
    ...yieldConfig,
    uprReset: uprResetConfig
  });

  const testAdSlotDomId = 'domId';

  const testMoliConfig = (loaded: behaviour.ISlotLoading['loaded'] = 'eager') =>
    ({
      ...emptyConfig,
      slots: [{ ...adUnit(`/123/${adUnitId}`, []), domId: testAdSlotDomId, behaviour: { loaded } }]
    }) as MoliConfig;

  const testRenderEndedEvent = (
    googleSlot: googletag.IAdSlot,
    isEmpty: boolean
  ): ISlotRenderEndedEvent => ({ slot: googleSlot, isEmpty }) as ISlotRenderEndedEvent;

  const labelServiceMock = (): any => {
    return {
      getDeviceLabel(): 'mobile' | 'desktop' {
        throw new Error('getDeviceLabel: not stubbed');
      },
      filterSlot(): boolean {
        throw new Error('filterSlot: not stubbed');
      }
    };
  };

  const createConfiguredModule = (
    providedYieldConfig: modules.yield_optimization.YieldOptimizationConfig = yieldConfig,
    testYieldOptimizationService?: YieldOptimizationService
  ) => {
    const module = YieldOptimization(testYieldOptimizationService);

    module.configure__({
      yieldOptimization: providedYieldConfig
    });
    const initStep = module.initSteps__()[0];
    const prepareRequestAdsStep = module.prepareRequestAdsSteps__()[0];
    return { module, initStep, prepareRequestAdsStep };
  };

  afterEach(() => {
    jsDomWindow = createDomAndWindow().jsDomWindow;
    jsDomWindow.googletag = createGoogletagStub();
    jsDomWindow.moli = {
      refreshAdSlot(): Promise<'queued' | 'refreshed'> {
        return Promise.resolve('refreshed');
      }
    } as unknown as MoliRuntime.MoliTag;
    sandbox.reset();
  });

  describe('init step', () => {
    it('should add yield-optimization optimization step', async () => {
      const { module } = createConfiguredModule();
      let initSteps = module.initSteps__();

      expect(initSteps).to.have.length(1);
      expect(initSteps.map(e => e.name)).to.include('yield-optimization-init');
    });

    it('should call init on the yield optimization service', async () => {
      const yieldOptimizationService = createYieldOptimizationService(yieldConfig);
      const { initStep } = createConfiguredModule(yieldConfig, yieldOptimizationService);

      const labelConfigService: any = labelServiceMock();
      const initSpy = sandbox.spy(yieldOptimizationService, 'init');

      // label config service returns 'desktop' as supported labels
      const getDeviceLabelStub = sandbox
        .stub(labelConfigService, 'getDeviceLabel')
        .returns('desktop');

      // a config with targeting labels set
      const config: MoliConfig = {
        ...emptyConfig,
        targeting: {
          keyValues: {},
          labels: ['foo']
        }
      };

      await initStep({
        config__: config,
        logger__: noopLogger,
        labelConfigService__: labelConfigService,
        adUnitPathVariables__: { device: 'desktop', domain: 'example.com' },
        window__: jsDomWindow
      } as any);

      expect(getDeviceLabelStub).to.have.been.calledOnce;
      expect(initSpy).to.have.been.calledOnce;
      expect(initSpy).to.have.been.calledOnceWithExactly(
        'desktop',
        {
          device: 'desktop',
          domain: 'example.com'
        },
        [],
        jsDomWindow.fetch,
        noopLogger
      );
    });

    it('should filter ad unit paths based on labels', async () => {
      const yieldOptimizationService = createYieldOptimizationService(yieldConfig);
      const { initStep } = createConfiguredModule(yieldConfig, yieldOptimizationService);

      const labelConfigService: any = labelServiceMock();
      const initSpy = sandbox.spy(yieldOptimizationService, 'init');

      // label config service returns 'desktop' as supported labels
      const getDeviceLabelStub = sandbox
        .stub(labelConfigService, 'getDeviceLabel')
        .returns('desktop');

      const filterSlotStub = sandbox
        .stub(labelConfigService, 'filterSlot')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false);

      // a config with targeting labels set
      const config: MoliConfig = {
        ...emptyConfig,
        slots: [adUnit('/123/foo', ['desktop']), adUnit('/123/bar', ['mobile'])]
      };

      const adUnitPathVariables = { device: 'desktop', domain: 'example.com' };
      await initStep({
        config__: config,
        logger__: noopLogger,
        labelConfigService__: labelConfigService,
        adUnitPathVariables__: adUnitPathVariables,
        window__: jsDomWindow
      } as any);
      expect(getDeviceLabelStub).to.have.been.calledOnce;
      expect(filterSlotStub).to.have.been.calledTwice;
      expect(initSpy).to.have.been.calledOnce;
      expect(initSpy).to.have.been.calledOnceWithExactly(
        'desktop',
        adUnitPathVariables,
        ['/123/foo'],
        jsDomWindow.fetch,
        noopLogger
      );
    });

    it('should filter out duplicated adUnitPaths before initializing yieldOptimizationService', async () => {
      const yieldOptimizationService = createYieldOptimizationService(yieldConfig);
      const { initStep } = createConfiguredModule(yieldConfig, yieldOptimizationService);
      const labelConfigService: any = labelServiceMock();
      const initSpy = sandbox.spy(yieldOptimizationService, 'init');

      // label config service returns 'desktop' as supported labels
      sandbox.stub(labelConfigService, 'getDeviceLabel').returns('desktop');

      sandbox
        .stub(labelConfigService, 'filterSlot')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(true);

      // a config with targeting labels set
      const config: MoliConfig = {
        ...emptyConfig,
        slots: [adUnit('/123/foo', ['desktop']), adUnit('/123/foo', ['desktop'])]
      };

      const adUnitPathVariables = { device: 'desktop', domain: 'example.com' };
      await initStep({
        config__: config,
        logger__: noopLogger,
        labelConfigService__: labelConfigService,
        adUnitPathVariables__: adUnitPathVariables,
        window__: jsDomWindow
      } as any);
      expect(initSpy).to.have.been.calledOnce;
      expect(initSpy).to.have.been.calledOnceWithExactly(
        'desktop',
        adUnitPathVariables,
        ['/123/foo'],
        jsDomWindow.fetch,
        noopLogger
      );
    });
  });

  describe('prepare request ads step', () => {
    it('should add yield-optimization optimization step', async () => {
      const { module } = createConfiguredModule();
      let prepareRequestAdsSteps = module.prepareRequestAdsSteps__();

      expect(prepareRequestAdsSteps).to.have.length(1);
      expect(prepareRequestAdsSteps.map(e => e.name)).to.include('yield-optimization');
    });

    it('set theTargeting on the google tag', async () => {
      const yieldOptimizationService = createYieldOptimizationService(yieldConfig);
      const { initStep, prepareRequestAdsStep } = createConfiguredModule(
        yieldConfig,
        yieldOptimizationService
      );
      const adSlot = googleAdSlotStub(`/123/${adUnitId}`, adUnitId);

      const slot: MoliRuntime.SlotDefinition = {
        moliSlot: {} as any,
        adSlot,
        filterSupportedSizes: givenSizes => givenSizes
      };

      const setTargetingStub = sandbox
        .stub(yieldOptimizationService, 'setTargeting')
        .resolves(yieldConfig.config.rules[adUnitId]);

      const ctx = newAdPipelineContext(jsDomWindow);
      await initStep(ctx);
      await prepareRequestAdsStep(ctx, [slot]);
      expect(slot.priceRule).to.be.ok;
      expect(slot.priceRule).to.be.deep.equals(yieldConfig.config.rules[adUnitId]);
      expect(setTargetingStub).to.have.been.calledOnce;
      expect(setTargetingStub).to.have.been.calledOnceWithExactly(
        adSlot,
        'gam',
        Sinon.match.any, // logger
        yieldConfig,
        Sinon.match.any, // auction context
        Sinon.match.any // upr reset state
      );
    });

    it('sets the browser returned by getBrowser', async () => {
      const yieldOptimizationService = createYieldOptimizationService(yieldConfig);
      const { prepareRequestAdsStep } = createConfiguredModule(
        yieldConfig,
        yieldOptimizationService
      );

      const setConfigSpy = sandbox.spy(jsDomWindow.googletag, 'setConfig');

      const getBrowserStub = sandbox
        .stub(yieldOptimizationService, 'getBrowser')
        .resolves('Chrome');

      await prepareRequestAdsStep(newAdPipelineContext(jsDomWindow), []);

      expect(getBrowserStub).to.have.been.calledOnce;
      expect(setConfigSpy).to.have.been.calledOnce;
      expect(setConfigSpy).to.have.been.calledOnceWithExactly({
        targeting: { upr_browser: 'Chrome' }
      });
    });
  });

  describe('configure step: UPR Reset Empty Refresh', () => {
    beforeEach(() => {
      jsDomWindow.moli = {
        refreshAdSlot(): Promise<'queued' | 'refreshed'> {
          return Promise.resolve('refreshed');
        }
      } as unknown as MoliRuntime.MoliTag;
    });

    it('should not register a configure step when uprReset is not configured', () => {
      const { module } = createConfiguredModule(yieldConfig);
      expect(module.configureSteps__()).to.have.length(0);
    });

    it('should register exactly one configure step when uprReset is configured', () => {
      const { module } = createConfiguredModule(yieldConfigWithUprReset(uprReset));
      const configureSteps = module.configureSteps__();
      expect(configureSteps).to.have.length(1);
      expect(configureSteps.map(step => step.name)).to.include(
        'yield-optimization-upr-reset-empty-refresh'
      );
    });

    it('should register the slotRenderEnded listener only once', async () => {
      const { module } = createConfiguredModule(yieldConfigWithUprReset(uprReset));
      const configureStep = module.configureSteps__()[0];
      const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

      await configureStep(newAdPipelineContext(jsDomWindow, 'production', testMoliConfig()), []);
      // requestId__/requestAdsCalls__ !== 1 -> guarded, listener not registered again
      await configureStep(
        { ...newAdPipelineContext(jsDomWindow, 'production', testMoliConfig()), requestId__: 2 },
        []
      );

      expect(listenerSpy).to.have.been.calledOnce;
      expect(listenerSpy).to.have.been.calledWithMatch('slotRenderEnded');
    });

    it('should strip the floor and refresh the slot once on a genuinely empty render', async () => {
      const { module } = createConfiguredModule(yieldConfigWithUprReset(uprReset));
      const configureStep = module.configureSteps__()[0];
      // dedicated logger instance - the shared `noopLogger` singleton is spied on by other
      // test files without ever being restored, so spying it here would collide with them
      const debugLogger = newNoopLogger();
      const debugSpy = sandbox.spy(debugLogger, 'debug');
      const refreshAdSlotSpy = sandbox.spy(jsDomWindow.moli, 'refreshAdSlot');
      const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

      await configureStep(
        {
          ...newAdPipelineContext(jsDomWindow, 'production', testMoliConfig()),
          logger__: debugLogger
        },
        []
      );
      const slotRenderedCallback = (listenerSpy.args as any[]).find(
        args => args[0] === 'slotRenderEnded'
      )?.[1];

      const adSlot = googleAdSlotStub(`/123/${adUnitId}`, testAdSlotDomId);
      slotRenderedCallback(testRenderEndedEvent(adSlot, true));

      expect(refreshAdSlotSpy).to.have.been.calledOnceWithExactly(testAdSlotDomId, {
        loaded: 'eager',
        force: true
      });
      expect(debugSpy).to.have.been.called;

      // a second empty render for the same ad unit path must not trigger another refresh
      slotRenderedCallback(testRenderEndedEvent(adSlot, true));
      expect(refreshAdSlotSpy).to.have.been.calledOnce;
    });

    it('should not refresh a slot that is excluded by dom id', async () => {
      const { module } = createConfiguredModule(
        yieldConfigWithUprReset({ excludeAdSlotDomIds: [testAdSlotDomId] })
      );
      const configureStep = module.configureSteps__()[0];
      const refreshAdSlotSpy = sandbox.spy(jsDomWindow.moli, 'refreshAdSlot');
      const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

      await configureStep(newAdPipelineContext(jsDomWindow, 'production', testMoliConfig()), []);
      const slotRenderedCallback = (listenerSpy.args as any[]).find(
        args => args[0] === 'slotRenderEnded'
      )?.[1];

      const adSlot = googleAdSlotStub(`/123/${adUnitId}`, testAdSlotDomId);
      slotRenderedCallback(testRenderEndedEvent(adSlot, true));

      expect(refreshAdSlotSpy).to.not.have.been.called;
    });

    it('should not refresh a slot that is not empty', async () => {
      const { module } = createConfiguredModule(yieldConfigWithUprReset(uprReset));
      const configureStep = module.configureSteps__()[0];
      const refreshAdSlotSpy = sandbox.spy(jsDomWindow.moli, 'refreshAdSlot');
      const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

      await configureStep(newAdPipelineContext(jsDomWindow, 'production', testMoliConfig()), []);
      const slotRenderedCallback = (listenerSpy.args as any[]).find(
        args => args[0] === 'slotRenderEnded'
      )?.[1];

      const adSlot = googleAdSlotStub(`/123/${adUnitId}`, testAdSlotDomId);
      slotRenderedCallback(testRenderEndedEvent(adSlot, false));

      expect(refreshAdSlotSpy).to.not.have.been.called;
    });

    it('should not refresh an infinite slot', async () => {
      const { module } = createConfiguredModule(yieldConfigWithUprReset(uprReset));
      const configureStep = module.configureSteps__()[0];
      const refreshAdSlotSpy = sandbox.spy(jsDomWindow.moli, 'refreshAdSlot');
      const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

      await configureStep(
        newAdPipelineContext(jsDomWindow, 'production', testMoliConfig('infinite')),
        []
      );
      const slotRenderedCallback = (listenerSpy.args as any[]).find(
        args => args[0] === 'slotRenderEnded'
      )?.[1];

      const adSlot = googleAdSlotStub(`/123/${adUnitId}`, testAdSlotDomId);
      slotRenderedCallback(testRenderEndedEvent(adSlot, true));

      expect(refreshAdSlotSpy).to.not.have.been.called;
    });
  });
});
