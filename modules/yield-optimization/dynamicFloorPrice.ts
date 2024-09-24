import { Moli } from '@highfivve/ad-tag/lib/types/moli';
import PriceRule = Moli.yield_optimization.PriceRule;
import { DynamicFloorPriceStrategy } from './index';

const previousMaxCpm = (cpms: number[]): null | number => {
  if (cpms.length === 0) {
    return null;
  } else {
    const maxBid = Math.max(...cpms);
    return Math.round(maxBid * 100);
  }
};

const previousMinCpm = (cpms: number[]): null | number => {
  if (cpms.length === 0) {
    return null;
  } else {
    const minBid = Math.min(...cpms);
    return Math.round(minBid * 100);
  }
};

const previousSecondHighestCpm = (cpms: number[]): null | number => {
  if (!cpms || cpms.length === 0) {
    return null;
  } else if (cpms.length === 1) {
    // return the only bid if there is only one
    return Math.round(cpms[0] * 100);
  } else {
    const secondHighestBid = cpms.sort()[cpms.length - 2];
    return Math.round(secondHighestBid * 100);
  }
};

const calculateDynamicFloorPrice = (
  strategy: DynamicFloorPriceStrategy | undefined,
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

/**
 * Rounds down a price in cents to the nearest multiple of the given rounding step in cents.
 * Ensures the rounded price does not exceed the max floor price if provided.
 *
 * @param priceInCents - The price in cents to be rounded down.
 * @param roundingStepInCents - The rounding step in cents.
 * @param [maxPriceRuleInCents] - The maximum configured price rule (UPR) in cents.
 * @param [minPriceRuleInCents] - The minimum configured price rule (UPR) in cents.
 * @returns roundedPriceInCents - The rounded down price in cents.
 */
const roundDownPrice = (
  priceInCents: number,
  roundingStepInCents: number,
  maxPriceRuleInCents?: number,
  minPriceRuleInCents?: number
): number => {
  const roundedPriceInCents = Math.floor(priceInCents / roundingStepInCents) * roundingStepInCents;
  if (maxPriceRuleInCents !== undefined && roundedPriceInCents > maxPriceRuleInCents) {
    return maxPriceRuleInCents;
  }
  if (minPriceRuleInCents !== undefined && roundedPriceInCents < minPriceRuleInCents) {
    return minPriceRuleInCents;
  }
  return roundedPriceInCents;
};

/**
 * Calculates a dynamic price rule based on the provided strategy and previous bid CPMs.
 * The function
 *  - filters out invalid CPMs (negative values, values under 10 cents, values above 30 euros, NaN)
 *  - calculates the new floor price based on the strategy
 *  - rounds it down to the nearest multiple of the given rounding step
 *  - ensures the rounded price does not exceed the maximum floor price if provided
 *
 *  This function is needed to overwrite the standard price rule from the yield optimization (which could e.g. be 0.50 EUR floor price independent of current bids on the position)
 *  with a dynamic floor price based on previous bids on the position.
 *
 * ! Caution: everything here assumes EUR as a currency and does not work with other currencies
 *  - EUR as currency has to be configured in prebid!
 *
 * @param strategy - The strategy to use for calculating the dynamic floor price. Can be 'max', 'min', or 'second-highest'.
 * @param previousCpms - An array of previous CPM values to base the calculation on (currently only available for prebid).
 * @param standardRule - The standard price rule to fall back on if no valid CPMs are provided or the strategy is undefined.
 * @param roundingStepsInCents - The rounding step in cents to round down the calculated floor price (upr_ids in GAM is set in 5 cent steps atm).
 * @param [maxPriceRuleInCents] - The optional maximum price rule in cents. If the rounded price rule exceeds this value, it will be capped at this maximum (max. configured upr_id value is 500 cents atm).
 * @param [minPriceRuleInCents] - The optional minimum price rule in cents. If the rounded price rule is below this value, it will be set to this minimum (min. configured upr_id value is 5 cents atm).
 * @returns {PriceRule} - The calculated dynamic price rule with the updated floor price and price rule ID - each upr_id addresses a price rule (floor price) in GAM.
 *
 * @example
 * const strategy = 'max';
 * const previousCpms = [0.3, 1.43, 1.44, 0.8];
 * const standardRule = { floorprice: 1.0, priceRuleId: 100, model: 'static', main: true };
 * const roundingStepsInCents = 5;
 * const maxFloorInCents = 500;
 * const result = calculateDynamicPriceRule(strategy, previousCpms, standardRule, roundingStepsInCents, maxFloorInCents);
 * // result: { floorprice: 1.44, priceRuleId: 140, model: 'static', main: true }
 */
export const calculateDynamicPriceRule = (
  strategy: DynamicFloorPriceStrategy | undefined,
  previousCpms: number[] | undefined,
  standardRule: PriceRule,
  roundingStepsInCents: number,
  maxPriceRuleInCents?: number,
  minPriceRuleInCents?: number
): PriceRule => {
  // filter out negative numbers and NaN
  const validPreviousCpms = previousCpms?.filter(cpm => cpm > 0 && !isNaN(cpm));
  if (!validPreviousCpms || validPreviousCpms.length === 0 || !strategy) {
    return standardRule;
  }

  const calculatedFloorPrice = calculateDynamicFloorPrice(strategy, validPreviousCpms);
  if (calculatedFloorPrice === null) {
    return standardRule;
  }

  const roundedPriceRuleIdInCents = roundDownPrice(
    calculatedFloorPrice,
    roundingStepsInCents,
    maxPriceRuleInCents,
    minPriceRuleInCents
  );

  return {
    ...standardRule,
    floorprice: calculatedFloorPrice / 100,
    priceRuleId: roundedPriceRuleIdInCents
  };
};
