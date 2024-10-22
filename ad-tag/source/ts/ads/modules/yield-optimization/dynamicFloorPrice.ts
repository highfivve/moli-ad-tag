import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { modules } from 'ad-tag/types/moliConfig';

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
  strategy: modules.yield_optimization.DynamicFloorPriceStrategy | undefined,
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
 * Rounds down a number to the nearest integer.
 *
 * @param num - The number to round down.
 * @returns number - The rounded integer.
 */
const roundDownToInteger = (num: number): number => {
  return Math.floor(num);
};

/**
 * Rounds down a price in cents to the nearest multiple of the given rounding step in cents.
 * Ensures the rounded price does not exceed the max floor price if provided.
 *
 * All params must be integers and will be rounded down to the nearest integer if they are not.
 *
 * @param priceInCents - The price in cents to be rounded down.
 * @param roundingStepInCents - The rounding step in cents.
 * @param [maxPriceRuleInCents] - The maximum configured price rule (UPR) in cents.
 * @param [minPriceRuleInCents] - The minimum configured price rule (UPR) in cents.
 * @returns roundedPriceInCents - The rounded down price in cents - must be an integer!
 */
interface RoundDownPrice {
  priceInCents: number;
  roundingStepsInCents: number;
  maxPriceRuleInCents?: number;
  minPriceRuleInCents?: number;
}

const roundDownPrice = (args: RoundDownPrice): number => {
  // Round down to integers
  const priceInCents = roundDownToInteger(args.priceInCents);
  const roundingStepsInCents = roundDownToInteger(args.roundingStepsInCents);
  const maxPriceRuleInCents =
    args.maxPriceRuleInCents !== undefined
      ? roundDownToInteger(args.maxPriceRuleInCents)
      : undefined;
  const minPriceRuleInCents =
    args.minPriceRuleInCents !== undefined
      ? roundDownToInteger(args.minPriceRuleInCents)
      : undefined;

  const roundedPriceInCents =
    Math.floor(priceInCents / roundingStepsInCents) * roundingStepsInCents;
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
 *  - filters out invalid CPMs (negative values, NaN)
 *  - calculates the new floor price based on the strategy
 *  - rounds it down to the nearest multiple of the given rounding step
 *  - ensures the rounded price does not exceed the maximum price rule if provided
 *  - ensures the rounded price does not lie below the minimum price rule if provided
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
 * @param roundingStepsInCents - The rounding step in cents to round down the calculated floor price.
 * @param [maxPriceRuleInCents] - The optional maximum price rule in cents. If the rounded price rule exceeds this value, it will be capped at this maximum (max. configured upr_id value is 500 cents atm).
 * @param [minPriceRuleInCents] - The optional minimum price rule in cents. If the rounded price rule is below this value, it will be set to this minimum (min. configured upr_id value is 5 cents atm).
 * @returns {PriceRule} - The calculated dynamic price rule with the updated floor price and price rule ID - each upr_id addresses a price rule (floor price) in GAM.
 *
 * @see more about UPR targeting here: https://gutefrage.atlassian.net/wiki/spaces/SBD/pages/26117427/Ad+Manager+Key+Values
 *
 * @example
 * const strategy = 'max';
 * const previousCpms = [0.3, 1.43, 1.44, 0.8];
 * const standardRule = { floorprice: 1.0, priceRuleId: 100, model: 'static', main: true };
 * const roundingStepsInCents = 5;
 * const maxFloorInCents = 500;
 * const minFloorInCents = 5;
 * const result = calculateDynamicPriceRule(strategy, previousCpms, standardRule, roundingStepsInCents, maxFloorInCents, minFloorInCents);
 * // result: { floorprice: 1.40, priceRuleId: 140, model: 'static', main: true }
 */
interface CalculateDynamicPriceRule {
  strategy: modules.yield_optimization.DynamicFloorPriceStrategy | undefined;
  previousCpms: number[] | undefined;
  standardRule: MoliRuntime.yield_optimization.PriceRule;
  roundingStepsInCents: number;
  maxPriceRuleInCents?: number;
  minPriceRuleInCents?: number;
}
export const calculateDynamicPriceRule = ({
  strategy,
  previousCpms,
  standardRule,
  roundingStepsInCents = 5,
  maxPriceRuleInCents = 500,
  minPriceRuleInCents = 5
}: CalculateDynamicPriceRule): MoliRuntime.yield_optimization.PriceRule => {
  // filter out negative numbers and NaN
  const validPreviousCpms: number[] | undefined = Array.isArray(previousCpms)
    ? previousCpms?.filter(cpm => cpm > 0 && !isNaN(cpm))
    : [];
  if (!validPreviousCpms || validPreviousCpms.length === 0 || !strategy) {
    return standardRule;
  }

  const calculatedFloorPrice = calculateDynamicFloorPrice(strategy, validPreviousCpms);
  if (calculatedFloorPrice === null) {
    return standardRule;
  }

  const roundedPriceRuleIdInCents = roundDownPrice({
    priceInCents: calculatedFloorPrice,
    roundingStepsInCents,
    maxPriceRuleInCents,
    minPriceRuleInCents
  });

  return {
    ...standardRule,
    floorprice: roundedPriceRuleIdInCents / 100,
    priceRuleId: roundedPriceRuleIdInCents
  };
};
