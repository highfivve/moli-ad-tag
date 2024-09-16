import { Moli } from '../types/moli';
import PriceRule = Moli.yield_optimization.PriceRule;

export const previousMaxCpm = (cpms: number[]): null | number => {
  if (cpms.length === 0) {
    return null;
  } else {
    const maxBid = Math.max(...cpms);
    return Math.round(maxBid * 100);
  }
};

export const previousMinCpm = (cpms: number[]): null | number => {
  if (cpms.length === 0) {
    return null;
  } else {
    const minBid = Math.min(...cpms);
    return Math.round(minBid * 100);
  }
};

export const previousSecondHighestCpm = (cpms: number[]): null | number => {
  if (!cpms || cpms.length === 0) {
    return null;
  } else {
    const secondHighestBid = cpms.sort()[cpms.length - 2];
    return Math.round(secondHighestBid * 100);
  }
};

export const calculateDynamicFloorPrice = (
  strategy: 'max' | 'min' | 'second-highest',
  previousCpms: number[]
): number | null => {
  switch (strategy) {
    case 'max':
      return previousMaxCpm(previousCpms);
    case 'min':
      return previousMinCpm(previousCpms);
    case 'second-highest':
      return previousSecondHighestCpm(previousCpms);
    default:
      return null;
  }
};

export const calculateDynamicPriceRule = (
  strategy: 'max' | 'min' | 'second-highest',
  previousCpms: number[] | undefined,
  standardRule: PriceRule
): PriceRule => {
  if (previousCpms) {
    const calculatedFloorPrice = calculateDynamicFloorPrice(strategy, previousCpms);
    return {
      ...standardRule,
      // floorprice in euros
      floorprice: calculatedFloorPrice ? calculatedFloorPrice / 100 : standardRule.floorprice,
      // price rule id in cents
      priceRuleId: calculatedFloorPrice ? calculatedFloorPrice : standardRule.priceRuleId
    };
  } else {
    return standardRule;
  }
};
