import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

import { createAssetLoaderService, googletag, Moli } from '@highfivve/ad-tag';
import { createDom } from '@highfivve/ad-tag/tests/ts/stubs/browserEnvSetup';

import YieldOptimization, { IStaticYieldOptimizationConfig } from './index';
import { newEmptyConfig, noopLogger } from '@highfivve/ad-tag/lib/tests/ts/stubs/moliStubs';
import { YieldOptimizationService } from './yieldOptimizationService';
import { googleAdSlotStub } from '@highfivve/ad-tag/lib/tests/ts/stubs/googletagStubs';

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
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
        [],
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
// tslint:enable
