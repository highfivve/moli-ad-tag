import { expect } from 'chai';

import { calculateDynamicPriceRule } from './dynamicFloorPrice';
import { Moli } from '@highfivve/ad-tag/lib/types/moli';
import PriceRule = Moli.yield_optimization.PriceRule;

describe('dynamicFloorPrice', () => {
  describe('calculateDynamicPriceRule', () => {
    const standardRule: PriceRule = {
      floorprice: 0.5,
      priceRuleId: 1564,
      model: 'static',
      main: true
    };
    it('should return the standardRule rule if there is no list of previous cpms', () => {
      const strategy = 'max';
      const bidCpms = undefined;
      expect(
        calculateDynamicPriceRule({
          strategy,
          previousCpms: bidCpms,
          standardRule,
          roundingStepsInCents: 5,
          maxPriceRuleInCents: 500,
          minPriceRuleInCents: 5
        })
      ).to.deep.equal(standardRule);
    });
    it('should return the standardRule rule if there was no bid in the previous auction', () => {
      const strategy = 'max';
      const bidCpms = [];
      expect(
        calculateDynamicPriceRule({
          strategy,
          previousCpms: bidCpms,
          standardRule,
          roundingStepsInCents: 5,
          maxPriceRuleInCents: 500,
          minPriceRuleInCents: 5
        })
      ).to.deep.equal(standardRule);
    });
    it('should return the standardRule if there are only negative numbers in the bidCpms array', () => {
      const strategy = 'max';
      const bidCpms = [-0.3, -1.43, -1.44, -5.8];
      expect(
        calculateDynamicPriceRule({
          strategy,
          previousCpms: bidCpms,
          standardRule,
          roundingStepsInCents: 5,
          maxPriceRuleInCents: 500,
          minPriceRuleInCents: 5
        })
      ).to.deep.equal(standardRule);
    });
    it('should return the standardRule if there are only NaN bid cpms', () => {
      const strategy = 'max';
      const bidCpms = [NaN];
      expect(
        calculateDynamicPriceRule({
          strategy,
          previousCpms: bidCpms,
          standardRule,
          roundingStepsInCents: 5,
          maxPriceRuleInCents: 500,
          minPriceRuleInCents: 5
        })
      ).to.deep.equal(standardRule);
    });
    it('should be able to handle doubles as cpms', () => {
      const strategy = 'max';
      const bidCpms = [3.141592653589793, 4.641592743589793];
      expect(
        calculateDynamicPriceRule({
          strategy,
          previousCpms: bidCpms,
          standardRule,
          roundingStepsInCents: 5,
          maxPriceRuleInCents: 500,
          minPriceRuleInCents: 5
        })
      ).to.deep.equal({
        floorprice: 4.6,
        priceRuleId: 460,
        model: 'static',
        main: true
      });
    });
    it('should be able to handle doubles as roundingSteps, maxPriceRule and minPriceRule', () => {
      const strategy = 'max';
      const bidCpms = [3.141592653589793, 3.641592743589793, 5.641592743589793, 4.641592743589793];
      expect(
        calculateDynamicPriceRule({
          strategy,
          previousCpms: bidCpms,
          standardRule,
          roundingStepsInCents: 5.14,
          maxPriceRuleInCents: 500.641592743589793,
          minPriceRuleInCents: 5.141592653589793
        })
      ).to.deep.equal({
        floorprice: 5.0,
        priceRuleId: 500,
        model: 'static',
        main: true
      });
    });
    describe('when strategy is "max"', () => {
      it('should return the rounded down price rule of the highest valid bid', () => {
        const strategy = 'max';
        const bidCpms = [0.3, 1.43, 1.44, 0.8];
        expect(
          calculateDynamicPriceRule({
            strategy,
            previousCpms: bidCpms,
            standardRule,
            roundingStepsInCents: 5,
            maxPriceRuleInCents: 500,
            minPriceRuleInCents: 5
          })
        ).to.deep.equal({
          floorprice: 1.44,
          priceRuleId: 140,
          model: 'static',
          main: true
        });
      });
      it('should return the updated rule with the highest positive bid cpm', () => {
        const strategy = 'max';
        const bidCpms = [-0.3, 1.43, 1.44, -5.8];
        expect(
          calculateDynamicPriceRule({
            strategy,
            previousCpms: bidCpms,
            standardRule,
            roundingStepsInCents: 5,
            maxPriceRuleInCents: 500,
            minPriceRuleInCents: 5
          })
        ).to.deep.equal({
          floorprice: 1.44,
          priceRuleId: 140,
          model: 'static',
          main: true
        });
      });
      it('should return the maxPriceRuleInCents as new price rule if there was a bid above the maxPriceRuleInCents', () => {
        const strategy = 'max';
        const bidCpms = [0.3, 1.43, 1.44, 5.8];
        expect(
          calculateDynamicPriceRule({
            strategy,
            previousCpms: bidCpms,
            standardRule,
            roundingStepsInCents: 5,
            maxPriceRuleInCents: 500,
            minPriceRuleInCents: 5
          })
        ).to.deep.equal({
          floorprice: 5.8,
          priceRuleId: 500,
          model: 'static',
          main: true
        });
      });
      it('should return the maxPriceRuleInCents as new price rule if there was a very huge bid above the maxPriceRuleInCents', () => {
        const strategy = 'max';
        const bidCpms = [Number.MAX_VALUE, Number.MAX_SAFE_INTEGER];
        expect(
          calculateDynamicPriceRule({
            strategy,
            previousCpms: bidCpms,
            standardRule,
            roundingStepsInCents: 5,
            maxPriceRuleInCents: 500,
            minPriceRuleInCents: 5
          })
        ).to.deep.equal({
          floorprice: Infinity,
          priceRuleId: 500,
          model: 'static',
          main: true
        });
      });
    });
    describe('when strategy is "min"', () => {
      it('should return the rounded down price rule of the lowest valid bid', () => {
        const strategy = 'min';
        const bidCpms = [0, 0.21, 0.16];
        expect(
          calculateDynamicPriceRule({
            strategy,
            previousCpms: bidCpms,
            standardRule,
            roundingStepsInCents: 5,
            maxPriceRuleInCents: 500,
            minPriceRuleInCents: 5
          })
        ).to.deep.equal({
          floorprice: 0.16,
          priceRuleId: 15,
          model: 'static',
          main: true
        });
      });
      it('should return the updated rule with the lowest positive bid cpm', () => {
        const strategy = 'min';
        const bidCpms = [-0.3, 1.43, 1.44, -5.8];
        expect(
          calculateDynamicPriceRule({
            strategy,
            previousCpms: bidCpms,
            standardRule,
            roundingStepsInCents: 5,
            maxPriceRuleInCents: 500,
            minPriceRuleInCents: 5
          })
        ).to.deep.equal({
          floorprice: 1.43,
          priceRuleId: 140,
          model: 'static',
          main: true
        });
      });
      it('should return the minPriceRuleInCents if there are only valid bids below this value', () => {
        const strategy = 'min';
        const bidCpms = [0.09, 0.01];
        expect(
          calculateDynamicPriceRule({
            strategy,
            previousCpms: bidCpms,
            standardRule,
            roundingStepsInCents: 5,
            maxPriceRuleInCents: 500,
            minPriceRuleInCents: 5
          })
        ).to.deep.equal({
          floorprice: 0.01,
          priceRuleId: 5,
          model: 'static',
          main: true
        });
      });
      it('should return the minPriceRuleInCents if there are super small bids above 0', () => {
        const strategy = 'min';
        const bidCpms = [Number.MIN_VALUE, Number.MIN_SAFE_INTEGER];
        expect(
          calculateDynamicPriceRule({
            strategy,
            previousCpms: bidCpms,
            standardRule,
            roundingStepsInCents: 5,
            maxPriceRuleInCents: 500,
            minPriceRuleInCents: 5
          })
        ).to.deep.equal({
          floorprice: 0,
          priceRuleId: 5,
          model: 'static',
          main: true
        });
      });
    });
    describe('when strategy is "second-highest"', () => {
      it('should return the rounded down price rule of the second-highest bid', () => {
        const strategy = 'second-highest';
        const bidCpms = [0.33, 1.43, 1.44, 0.8];
        expect(
          calculateDynamicPriceRule({
            strategy,
            previousCpms: bidCpms,
            standardRule,
            roundingStepsInCents: 5,
            maxPriceRuleInCents: 500,
            minPriceRuleInCents: 5
          })
        ).to.deep.equal({
          floorprice: 1.43,
          priceRuleId: 140,
          model: 'static',
          main: true
        });
      });
      it('should use the only bid to calculate the new price rule when there is only one bid cpm', () => {
        const strategy = 'second-highest';
        const bidCpms = [0.21];
        expect(
          calculateDynamicPriceRule({
            strategy,
            previousCpms: bidCpms,
            standardRule,
            roundingStepsInCents: 5,
            maxPriceRuleInCents: 500,
            minPriceRuleInCents: 5
          })
        ).to.deep.equal({
          floorprice: 0.21,
          priceRuleId: 20,
          model: 'static',
          main: true
        });
      });
      it('should return the updated price rule with the second-highest positive bid cpm', () => {
        const strategy = 'second-highest';
        const bidCpms = [-0.3, 1.43, 1.44, -5.8];
        expect(
          calculateDynamicPriceRule({
            strategy,
            previousCpms: bidCpms,
            standardRule,
            roundingStepsInCents: 5,
            maxPriceRuleInCents: 500,
            minPriceRuleInCents: 5
          })
        ).to.deep.equal({
          floorprice: 1.43,
          priceRuleId: 140,
          model: 'static',
          main: true
        });
      });
      it('should return the updated price rule with the only positive bid cpm in case there is only one', () => {
        const strategy = 'second-highest';
        const bidCpms = [-0.3, 1.44, -5.8];
        expect(
          calculateDynamicPriceRule({
            strategy,
            previousCpms: bidCpms,
            standardRule,
            roundingStepsInCents: 5,
            maxPriceRuleInCents: 500,
            minPriceRuleInCents: 5
          })
        ).to.deep.equal({
          floorprice: 1.44,
          priceRuleId: 140,
          model: 'static',
          main: true
        });
      });
    });
  });
});
