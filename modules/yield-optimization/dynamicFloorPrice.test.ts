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
      expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal(
        standardRule
      );
    });
    it('should return the standardRule rule if there was no bid in the previous auction', () => {
      const strategy = 'max';
      const bidCpms = [];
      expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal(
        standardRule
      );
    });
    it('should return the standardRule if there are only negative numbers in the bidCpms array', () => {
      const strategy = 'max';
      const bidCpms = [-0.3, -1.43, -1.44, -5.8];
      expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal(
        standardRule
      );
    });
    it('should return the standardRule if there are only values under 10 cents in the bidCpms array', () => {
      const strategy = 'max';
      const bidCpms = [0, 0.005, 0, 0.08];
      expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal(
        standardRule
      );
    });
    it('should return the standardRule if there are only bids above 30 euros (that is where we set the validity "limit")', () => {
      const strategy = 'max';
      const bidCpms = [Number.MAX_VALUE, Number.MAX_SAFE_INTEGER, 45];
      expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal(
        standardRule
      );
    });
    it('should return the standardRule if there are only bids below 10 cents (upr_id at GAM starts at 10 cents)', () => {
      const strategy = 'max';
      const bidCpms = [Number.MIN_VALUE, Number.MIN_SAFE_INTEGER, 0.09];
      expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal(
        standardRule
      );
    });
    it('should return the standardRule if there are only NaN bid cpms', () => {
      const strategy = 'max';
      const bidCpms = [NaN];
      expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal(
        standardRule
      );
    });
    describe('when strategy is "max"', () => {
      it('should return the updated and rounded down rule of the highest bid if there was a bid below the maxFloorInCents', () => {
        const strategy = 'max';
        const bidCpms = [0.3, 1.43, 1.44, 0.8];
        expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal({
          floorprice: 1.44,
          priceRuleId: 140,
          model: 'static',
          main: true
        });
      });
      it('should return the updated and rounded down rule of the highest bid if there was at least one cpm above 10 cents', () => {
        const strategy = 'max';
        const bidCpms = [0, 0, 0.16];
        expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal({
          floorprice: 0.16,
          priceRuleId: 15,
          model: 'static',
          main: true
        });
      });
      it('should return the updated rule with the highest positive bid cpm', () => {
        const strategy = 'max';
        const bidCpms = [-0.3, 1.43, 1.44, -5.8];
        expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal({
          floorprice: 1.44,
          priceRuleId: 140,
          model: 'static',
          main: true
        });
      });
      it('should return the maxFloorInCents as new price rule if there was a bid above the maxFloorInCents', () => {
        const strategy = 'max';
        const bidCpms = [0.3, 1.43, 1.44, 5.8];
        expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal({
          floorprice: 5.8,
          priceRuleId: 500,
          model: 'static',
          main: true
        });
      });
    });
    describe('when strategy is "min"', () => {
      it('should return the updated and rounded down rule of the lowest bid if there was a bid below the maxFloorInCents', () => {
        const strategy = 'min';
        const bidCpms = [0.33, 1.43, 1.44, 0.8];
        expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal({
          floorprice: 0.33,
          priceRuleId: 30,
          model: 'static',
          main: true
        });
      });
      it('should return the updated and rounded down rule of the lowest bid if there was at least one cpm above 10 cents', () => {
        const strategy = 'min';
        const bidCpms = [0, 0.21, 0.16];
        expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal({
          floorprice: 0.16,
          priceRuleId: 15,
          model: 'static',
          main: true
        });
      });
      it('should return the updated rule with the lowest positive bid cpm', () => {
        const strategy = 'min';
        const bidCpms = [-0.3, 1.43, 1.44, -5.8];
        expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal({
          floorprice: 1.43,
          priceRuleId: 140,
          model: 'static',
          main: true
        });
      });
    });
    describe('when strategy is "second-highest"', () => {
      it('should return the updated and rounded down rule of the second-highest bid if there was a bid below the maxFloorInCents', () => {
        const strategy = 'second-highest';
        const bidCpms = [0.33, 1.43, 1.44, 0.8];
        expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal({
          floorprice: 1.43,
          priceRuleId: 140,
          model: 'static',
          main: true
        });
      });
      it('should return the standardRule if there was no valid second-highest bid', () => {
        const strategy = 'second-highest';
        const bidCpms = [0, 0.21];
        expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal(
          standardRule
        );
      });
      it('should return the updated rule with the second-highest positive bid cpm', () => {
        const strategy = 'second-highest';
        const bidCpms = [-0.3, 1.43, 1.44, -5.8];
        expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule, 5, 500)).to.deep.equal({
          floorprice: 1.43,
          priceRuleId: 140,
          model: 'static',
          main: true
        });
      });
    });
  });
});
