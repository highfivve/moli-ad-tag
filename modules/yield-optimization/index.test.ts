import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { createAssetLoaderService, googletag, Moli } from '@highfivve/ad-tag';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import { emptyConfig, newEmptyConfig, noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { googleAdSlotStub } from '@highfivve/ad-tag/lib/stubs/googletagStubs';

import YieldOptimization, { IStaticYieldOptimizationConfig } from './index';
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
  const yieldConfig: IStaticYieldOptimizationConfig = {
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

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    sandbox.reset();
  });

  describe('init step', () => {
    it('should add yield-optimization optimization step', async () => {
      const module = new YieldOptimization(yieldConfig, jsDomWindow);
      const config = newEmptyConfig();
      await module.init(config, assetLoader);

      expect(config.pipeline).to.be.ok;
      expect(config.pipeline?.initSteps).to.be.ok;
      expect(config.pipeline?.initSteps?.map(e => e.name)).to.include('yield-optimization-init');
    });

    it('should call init on the yield optimization service', async () => {
      const module = new YieldOptimization(yieldConfig, jsDomWindow);
      const yieldOptimizationService = new YieldOptimizationService(
        yieldConfig,
        noopLogger,
        jsDomWindow
      );

      const labelConfigService: any = {
        getSupportedLabels(): string[] {
          return [];
        }
      };

      const initSpy = sandbox.spy(yieldOptimizationService, 'init');

      // label config service returns 'desktop' as supported labels
      const getSupportedLabelsMock = sandbox
        .stub(labelConfigService, 'getSupportedLabels')
        .returns(['desktop']);

      // a config with targeting labels set
      const config: Moli.MoliConfig = {
        ...emptyConfig,
        targeting: {
          keyValues: {},
          labels: ['foo']
        }
      };

      await module.yieldOptimizationInit(yieldOptimizationService)({
        config: config,
        logger: noopLogger,
        labelConfigService: labelConfigService
      } as any);
      expect(getSupportedLabelsMock).to.have.been.calledOnce;
      expect(initSpy).to.have.been.calledOnce;
      expect(initSpy).to.have.been.calledOnceWithExactly(['foo', 'desktop']);
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
          logger: noopLogger
        } as any,
        [slot]
      );
      expect(slot.priceRule).to.be.ok;
      expect(slot.priceRule).to.be.deep.equals(yieldConfig.config.rules[adUnitId]);
      expect(setTargetingStub).to.have.been.calledOnce;
      expect(setTargetingStub).to.have.been.calledOnceWithExactly(adSlot);
    });
  });
});
