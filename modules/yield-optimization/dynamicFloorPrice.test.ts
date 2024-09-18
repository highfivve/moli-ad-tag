import { expect } from 'chai';

import {
  calculateDynamicFloorPrice,
  calculateDynamicPriceRule,
  previousMaxCpm,
  previousMinCpm,
  previousSecondHighestCpm
} from './dynamicFloorPrice';
import { Moli } from '@highfivve/ad-tag/lib/types/moli';
import PriceRule = Moli.yield_optimization.PriceRule;

describe('dynamicFloorPrice', () => {
  describe('previousMaxCpm', () => {
    it('should return the highest bid cpm in cents', () => {
      const bidCpms = [0.1, 2, 0.3, 1.1, 2.3];
      expect(previousMaxCpm(bidCpms)).to.equal(230);
    });
    it('should return null if there was no bid', () => {
      const bidCpms = [];
      expect(previousMaxCpm(bidCpms)).to.equal(null);
    });
  });

  describe('previousMinCpm', () => {
    it('should return the lowest bid cpm in cents', () => {
      const bidCpms = [0.1, 2, 0.3, 1.1, 2.3];
      expect(previousMinCpm(bidCpms)).to.equal(10);
    });
    it('should return null if there was no bid ', () => {
      const bidCpms = [];
      expect(previousMinCpm(bidCpms)).to.equal(null);
    });
  });

  describe('previousSecondHighestCpm', () => {
    it('should return the second highest bid cpm in cents', () => {
      const bidCpms = [0.1, 2, 0.3, 1.1, 2.3];
      expect(previousSecondHighestCpm(bidCpms)).to.equal(200);
    });
    it('should return null if there was no bid ', () => {
      const bidCpms = [];
      expect(previousSecondHighestCpm(bidCpms)).to.equal(null);
    });
  });

  describe('calculateDynamicFloorPrice', () => {
    it('should return null if there was no bid', () => {
      const strategy = 'max';
      const bidCpms = [];
      expect(calculateDynamicFloorPrice(strategy, bidCpms)).to.equal(null);
    });
    it('should return the highest cpm of all bids if strategy is max', () => {
      const strategy = 'max';
      const bidCpms = [0.3, 1.43, 1.44, 0.8];
      expect(calculateDynamicFloorPrice(strategy, bidCpms)).to.equal(144);
    });
    it('should return the lowest cpm of all bids if strategy is min', () => {
      const strategy = 'min';
      const bidCpms = [0.3, 1.43, 1.44, 0.8];
      expect(calculateDynamicFloorPrice(strategy, bidCpms)).to.equal(30);
    });
    it('should return the second highest cpm of all bids if strategy is second-highest', () => {
      const strategy = 'second-highest';
      const bidCpms = [0.3, 1.43, 1.44, 0.8];
      expect(calculateDynamicFloorPrice(strategy, bidCpms)).to.equal(143);
    });
  });

  describe('calculateDynamicPriceRule', () => {
    it('should return the standardRule rule if there is no list of previous cpms', () => {
      const strategy = 'max';
      const bidCpms = undefined;
      const standardRule: PriceRule = {
        floorprice: 0.5,
        priceRuleId: 1564,
        model: 'static',
        main: true
      };
      expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule)).to.deep.equal(
        standardRule
      );
    });
    it('should return the standardRule rule if there was no bid in the previous auction', () => {
      const strategy = 'max';
      const bidCpms = [];
      const standardRule: PriceRule = {
        floorprice: 0.5,
        priceRuleId: 1564,
        model: 'static',
        main: true
      };
      expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule)).to.deep.equal(
        standardRule
      );
    });
    it('should return the updated rule if there was a bid', () => {
      const strategy = 'max';
      const bidCpms = [0.3, 1.43, 1.44, 0.8];
      const standardRule: PriceRule = {
        floorprice: 0.5,
        priceRuleId: 1564,
        model: 'static',
        main: true
      };
      expect(calculateDynamicPriceRule(strategy, bidCpms, standardRule)).to.deep.equal({
        floorprice: 1.44,
        priceRuleId: 144,
        model: 'static',
        main: true
      });
    });
  });
});
