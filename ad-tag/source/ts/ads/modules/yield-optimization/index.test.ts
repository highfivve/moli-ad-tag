import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { YieldOptimization } from './index';
import {
  createYieldOptimizationService,
  YieldOptimizationService
} from './yieldOptimizationService';
import { AdSlot, modules, MoliConfig } from 'ad-tag/types/moliConfig';
import { emptyConfig, newAdPipelineContext, noopLogger } from 'ad-tag/stubs/moliStubs';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { createGoogletagStub, googleAdSlotStub } from 'ad-tag/stubs/googletagStubs';

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
        Sinon.match.any // auction context
      );
    });

    describe('prebidFloorPrice', () => {
      /**
       * Runs the prepare request ads step for a single slot whose price rule is the given one and
       * returns the floor price the module allowed through to prebid.
       */
      const prebidFloorPriceFor = async (
        priceRule: MoliRuntime.yield_optimization.PriceRule,
        floorModels?: ReadonlyArray<MoliRuntime.yield_optimization.UprModel>
      ): Promise<number | undefined> => {
        const config: modules.yield_optimization.YieldOptimizationConfig = {
          ...yieldConfig,
          ...(floorModels ? { floorModels } : {})
        };
        const yieldOptimizationService = createYieldOptimizationService(config);
        const { prepareRequestAdsStep } = createConfiguredModule(config, yieldOptimizationService);
        const slot: MoliRuntime.SlotDefinition = {
          moliSlot: { domId: adUnitId } as any,
          adSlot: googleAdSlotStub(`/123/${adUnitId}`, adUnitId),
          filterSupportedSizes: givenSizes => givenSizes
        };
        sandbox.stub(yieldOptimizationService, 'setTargeting').resolves(priceRule);

        await prepareRequestAdsStep(newAdPipelineContext(jsDomWindow), [slot]);
        return slot.prebidFloorPrice;
      };

      const rule = (
        model: MoliRuntime.yield_optimization.UprModel | undefined,
        floorprice: number
      ): MoliRuntime.yield_optimization.PriceRule => ({
        priceRuleId: 1,
        floorprice,
        main: true,
        model
      });

      it('should pass a static price through by default', async () => {
        expect(await prebidFloorPriceFor(rule('static', 0.2))).to.equal(0.2);
      });

      it('should pass a fixed price through by default', async () => {
        expect(await prebidFloorPriceFor(rule('fixed', 0.2))).to.equal(0.2);
      });

      it('should treat a rule without a model as static', async () => {
        expect(await prebidFloorPriceFor(rule(undefined, 0.2))).to.equal(0.2);
      });

      it('should withhold a google priced rule by default', async () => {
        expect(await prebidFloorPriceFor(rule('g', 1.5))).to.be.undefined;
      });

      it('should withhold a disabled rule by default', async () => {
        expect(await prebidFloorPriceFor(rule('disabled', 0.01))).to.be.undefined;
      });

      it('should pass a google priced rule through if g is allow-listed', async () => {
        expect(await prebidFloorPriceFor(rule('g', 1.5), ['static', 'fixed', 'g'])).to.equal(1.5);
      });

      it('should withhold a zero price even if the model is allow-listed', async () => {
        expect(await prebidFloorPriceFor(rule('g', 0), ['static', 'fixed', 'g'])).to.be.undefined;
      });

      it('should withhold a zero priced static rule', async () => {
        expect(await prebidFloorPriceFor(rule('static', 0))).to.be.undefined;
      });

      it('should leave prebidFloorPrice undefined if there is no price rule at all', async () => {
        const yieldOptimizationService = createYieldOptimizationService(yieldConfig);
        const { prepareRequestAdsStep } = createConfiguredModule(
          yieldConfig,
          yieldOptimizationService
        );
        const slot: MoliRuntime.SlotDefinition = {
          moliSlot: { domId: adUnitId } as any,
          adSlot: googleAdSlotStub(`/123/${adUnitId}`, adUnitId),
          filterSupportedSizes: givenSizes => givenSizes
        };
        sandbox.stub(yieldOptimizationService, 'setTargeting').resolves(undefined);

        await prepareRequestAdsStep(newAdPipelineContext(jsDomWindow), [slot]);
        expect(slot.prebidFloorPrice).to.be.undefined;
      });
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
});
