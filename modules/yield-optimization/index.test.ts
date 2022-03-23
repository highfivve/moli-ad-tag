import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { createAssetLoaderService, googletag, Moli } from '@highfivve/ad-tag';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import { emptyConfig, newEmptyConfig, noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { googleAdSlotStub } from '@highfivve/ad-tag/lib/stubs/googletagStubs';

import { YieldOptimization, StaticYieldOptimizationConfig } from './index';
import { YieldOptimizationService } from './yieldOptimizationService';

// setup sinon-chai
use(sinonChai);

describe('Yield Optimization module', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window & googletag.IGoogleTagWindow = dom.window as any;

  // unused
  const assetLoader = createAssetLoaderService(jsDomWindow);

  const adUnitId = 'adUnit1';
  const yieldConfig: StaticYieldOptimizationConfig = {
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

  const adUnit = (adUnitPath: string, labelAll: string[]): Moli.AdSlot => {
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

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    sandbox.reset();
  });

  describe('init step', () => {
    const module = new YieldOptimization(yieldConfig, jsDomWindow);

    it('should add yield-optimization optimization step', async () => {
      const config = newEmptyConfig();
      await module.init(config, assetLoader);

      expect(config.pipeline).to.be.ok;
      expect(config.pipeline?.initSteps).to.be.ok;
      expect(config.pipeline?.initSteps?.map(e => e.name)).to.include('yield-optimization-init');
    });

    it('should call init on the yield optimization service', async () => {
      const yieldOptimizationService = new YieldOptimizationService(
        yieldConfig,
        noopLogger,
        jsDomWindow
      );

      const labelConfigService: any = labelServiceMock();
      const initSpy = sandbox.spy(yieldOptimizationService, 'init');

      // label config service returns 'desktop' as supported labels
      const getDeviceLabelStub = sandbox
        .stub(labelConfigService, 'getDeviceLabel')
        .returns('desktop');

      // a config with targeting labels set
      const config: Moli.MoliConfig = {
        ...emptyConfig,
        targeting: {
          keyValues: {},
          labels: ['foo'],
          adUnitPathVariables: {
            foo: 'bar'
          }
        }
      };

      await module.yieldOptimizationInit(yieldOptimizationService)({
        config: config,
        logger: noopLogger,
        labelConfigService: labelConfigService
      } as any);
      expect(getDeviceLabelStub).to.have.been.calledOnce;
      expect(initSpy).to.have.been.calledOnce;
      expect(initSpy).to.have.been.calledOnceWithExactly(
        'desktop',
        {
          foo: 'bar'
        },
        []
      );
    });

    it('should filter ad unit paths based on labels', async () => {
      const yieldOptimizationService = new YieldOptimizationService(
        yieldConfig,
        noopLogger,
        jsDomWindow
      );

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
      const config: Moli.MoliConfig = {
        ...emptyConfig,
        slots: [adUnit('/123/foo', ['desktop']), adUnit('/123/bar', ['mobile'])]
      };

      await module.yieldOptimizationInit(yieldOptimizationService)({
        config: config,
        logger: noopLogger,
        labelConfigService: labelConfigService
      } as any);
      expect(getDeviceLabelStub).to.have.been.calledOnce;
      expect(filterSlotStub).to.have.been.calledTwice;
      expect(initSpy).to.have.been.calledOnce;
      expect(initSpy).to.have.been.calledOnceWithExactly('desktop', {}, ['/123/foo']);
    });

    it('should filter out duplicated adUnitPaths before initializing yieldOptimizationService', async () => {
      const yieldOptimizationService = new YieldOptimizationService(
        yieldConfig,
        noopLogger,
        jsDomWindow
      );

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
      const config: Moli.MoliConfig = {
        ...emptyConfig,
        slots: [adUnit('/123/foo', ['desktop']), adUnit('/123/foo', ['desktop'])]
      };

      await module.yieldOptimizationInit(yieldOptimizationService)({
        config: config,
        logger: noopLogger,
        labelConfigService: labelConfigService
      } as any);
      expect(initSpy).to.have.been.calledOnce;
      expect(initSpy).to.have.been.calledOnceWithExactly('desktop', {}, ['/123/foo']);
    });
  });

  describe('prepare request ads step', () => {
    it('should add yield-optimization optimization step', async () => {
      const module = new YieldOptimization(yieldConfig, jsDomWindow);
      const config = newEmptyConfig();
      await module.init(config, assetLoader);

      expect(config.pipeline).to.be.ok;
      expect(config.pipeline?.prepareRequestAdsSteps).to.be.ok;
      expect(config.pipeline?.prepareRequestAdsSteps?.map(e => e.name)).to.include(
        'yield-optimization'
      );
    });

    it('set theTargeting on the google tag', async () => {
      const module = new YieldOptimization(yieldConfig, jsDomWindow);
      const yieldOptimizationService = new YieldOptimizationService(
        yieldConfig,
        noopLogger,
        jsDomWindow
      );
      const adSlot = googleAdSlotStub(`/123/${adUnitId}`, adUnitId);

      const slot: Moli.SlotDefinition = {
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
      expect(setTargetingStub).to.have.been.calledOnceWithExactly(adSlot, 'gam');
    });

    it('sets the browser returned by getBrowser', async () => {
      const module = new YieldOptimization(yieldConfig, jsDomWindow);
      const yieldOptimizationService = new YieldOptimizationService(
        yieldConfig,
        noopLogger,
        jsDomWindow
      );

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
