import { createDom } from 'ad-tag/stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { YieldOptimization } from './index';
import { YieldOptimizationService } from './yieldOptimizationService';
import { googletag } from 'ad-tag/types/googletag';
import { AdSlot, modules, MoliConfig } from 'ad-tag/types/moliConfig';
import { emptyConfig, noopLogger } from 'ad-tag/stubs/moliStubs';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { googleAdSlotStub } from 'ad-tag/stubs/googletagStubs';

// setup sinon-chai
use(sinonChai);

describe('Yield Optimization module', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window & googletag.IGoogleTagWindow = dom.window as any;

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
    providedYieldConfig: modules.yield_optimization.YieldOptimizationConfig = yieldConfig
  ): YieldOptimization => {
    const module = new YieldOptimization();
    module.configure({
      yieldOptimization: providedYieldConfig
    });
    return module;
  };

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    sandbox.reset();
  });

  describe('init step', () => {
    it('should add yield-optimization optimization step', async () => {
      const module = createConfiguredModule();
      let initSteps = module.initSteps();

      expect(initSteps).to.have.length(1);
      expect(initSteps.map(e => e.name)).to.include('yield-optimization-init');
    });

    it('should call init on the yield optimization service', async () => {
      const module = new YieldOptimization();
      const yieldOptimizationService = new YieldOptimizationService(yieldConfig);

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

      await module.yieldOptimizationInit(yieldOptimizationService)({
        config: config,
        logger: noopLogger,
        labelConfigService: labelConfigService,
        adUnitPathVariables: { device: 'desktop', domain: 'example.com' },
        window: jsDomWindow
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
      const module = new YieldOptimization();
      const yieldOptimizationService = new YieldOptimizationService(yieldConfig);

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
      await module.yieldOptimizationInit(yieldOptimizationService)({
        config: config,
        logger: noopLogger,
        labelConfigService: labelConfigService,
        adUnitPathVariables: adUnitPathVariables,
        window: jsDomWindow
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
      const module = new YieldOptimization();
      const yieldOptimizationService = new YieldOptimizationService(yieldConfig);

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
      await module.yieldOptimizationInit(yieldOptimizationService)({
        config: config,
        logger: noopLogger,
        labelConfigService: labelConfigService,
        adUnitPathVariables: adUnitPathVariables,
        window: jsDomWindow
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
      const module = createConfiguredModule();
      let prepareRequestAdsSteps = module.prepareRequestAdsSteps();

      expect(prepareRequestAdsSteps).to.have.length(1);
      expect(prepareRequestAdsSteps.map(e => e.name)).to.include('yield-optimization');
    });

    it('set theTargeting on the google tag', async () => {
      const module = new YieldOptimization();
      const yieldOptimizationService = new YieldOptimizationService(yieldConfig);
      const adSlot = googleAdSlotStub(`/123/${adUnitId}`, adUnitId);

      const slot: MoliRuntime.SlotDefinition = {
        moliSlot: {} as any,
        adSlot,
        filterSupportedSizes: givenSizes => givenSizes
      };

      const setTargetingStub = sandbox
        .stub(yieldOptimizationService, 'setTargeting')
        .resolves(yieldConfig.config.rules[adUnitId]);

      await module.yieldOptimizationPrepareRequestAds(yieldOptimizationService)(
        {
          logger: noopLogger,
          config: {}
        } as any,
        [slot]
      );
      expect(slot.priceRule).to.be.ok;
      expect(slot.priceRule).to.be.deep.equals(yieldConfig.config.rules[adUnitId]);
      expect(setTargetingStub).to.have.been.calledOnce;
      expect(setTargetingStub).to.have.been.calledOnceWithExactly(
        adSlot,
        'gam',
        noopLogger,
        null,
        undefined
      );
    });

    it('sets the browser returned by getBrowser', async () => {
      const module = new YieldOptimization();
      const yieldOptimizationService = new YieldOptimizationService(yieldConfig);

      const setTargetingSpy = sandbox.spy();

      const getBrowserStub = sandbox
        .stub(yieldOptimizationService, 'getBrowser')
        .resolves('Chrome');

      await module.yieldOptimizationPrepareRequestAds(yieldOptimizationService)(
        {
          env: 'production',
          logger: noopLogger,
          config: {},
          window: {
            googletag: {
              pubads: () => {
                return { setTargeting: setTargetingSpy };
              }
            }
          }
        } as any,
        []
      );

      expect(getBrowserStub).to.have.been.calledOnce;
      expect(setTargetingSpy).to.have.been.calledOnce;
      expect(setTargetingSpy).to.have.been.calledOnceWithExactly('upr_browser', 'Chrome');
    });
  });
});
