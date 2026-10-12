import { expect } from 'chai';

import { DEFAULT_FLOOR_MODELS, resolvePrebidFloorPrice } from './floorModels';
import { modules } from 'ad-tag/types/moliConfig';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';

describe('floorModels', () => {
  const priceRule = (
    overrides: Partial<MoliRuntime.yield_optimization.PriceRule> = {}
  ): MoliRuntime.yield_optimization.PriceRule => ({
    priceRuleId: 50,
    floorprice: 0.5,
    main: true,
    ...overrides
  });

  const yieldConfig = (
    floorModels?: ReadonlyArray<MoliRuntime.yield_optimization.UprModel>
  ): modules.yield_optimization.YieldOptimizationConfig => ({
    enabled: true,
    provider: 'dynamic',
    configEndpoint: '//localhost',
    excludedAdUnitPaths: [],
    ...(floorModels ? { floorModels } : {})
  });

  describe('DEFAULT_FLOOR_MODELS', () => {
    it('should keep static and fixed sending floors', () => {
      expect(DEFAULT_FLOOR_MODELS).to.deep.equal(['static', 'fixed']);
    });
  });

  describe('resolvePrebidFloorPrice', () => {
    it('should send the price of a static rule if there is no yield config at all', () => {
      expect(resolvePrebidFloorPrice(priceRule({ model: 'static' }), null)).to.equal(0.5);
    });

    it('should send the price of a static rule if floorModels is absent', () => {
      expect(resolvePrebidFloorPrice(priceRule({ model: 'static' }), yieldConfig())).to.equal(0.5);
    });

    it('should send the price of a fixed rule if floorModels is absent', () => {
      expect(resolvePrebidFloorPrice(priceRule({ model: 'fixed' }), yieldConfig())).to.equal(0.5);
    });

    it('should treat a missing model as static', () => {
      expect(resolvePrebidFloorPrice(priceRule({ model: undefined }), yieldConfig())).to.equal(0.5);
    });

    it('should not send the price of a google priced rule by default', () => {
      expect(resolvePrebidFloorPrice(priceRule({ model: 'g' }), yieldConfig())).to.be.undefined;
    });

    it('should not send the price of a disabled rule by default', () => {
      expect(
        resolvePrebidFloorPrice(priceRule({ model: 'disabled', floorprice: 0.01 }), yieldConfig())
      ).to.be.undefined;
    });

    it('should send the price of a google priced rule if g is allow-listed', () => {
      expect(
        resolvePrebidFloorPrice(
          priceRule({ model: 'g', floorprice: 1.5 }),
          yieldConfig(['static', 'fixed', 'g'])
        )
      ).to.equal(1.5);
    });

    it('should send the price of a disabled rule if disabled is allow-listed', () => {
      expect(
        resolvePrebidFloorPrice(
          priceRule({ model: 'disabled', floorprice: 0.01 }),
          yieldConfig(['static', 'fixed', 'disabled'])
        )
      ).to.equal(0.01);
    });

    it('should not send a zero price even if the model is allow-listed', () => {
      expect(resolvePrebidFloorPrice(priceRule({ model: 'g', floorprice: 0 }), yieldConfig(['g'])))
        .to.be.undefined;
    });

    it('should not send a zero price for a static rule', () => {
      expect(resolvePrebidFloorPrice(priceRule({ model: 'static', floorprice: 0 }), yieldConfig()))
        .to.be.undefined;
    });

    it('should not send a negative price', () => {
      expect(resolvePrebidFloorPrice(priceRule({ model: 'static', floorprice: -1 }), yieldConfig()))
        .to.be.undefined;
    });

    it('should not send anything if the allow list is empty', () => {
      expect(resolvePrebidFloorPrice(priceRule({ model: 'static' }), yieldConfig([]))).to.be
        .undefined;
    });
  });
});
