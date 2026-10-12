import { modules } from 'ad-tag/types/moliConfig';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';

/**
 * Delivered `upr_model` values that may hand their price to the prebid floors module when a
 * publisher bundle does not configure `floorModels` explicitly.
 *
 * `static` and `fixed` are the only models that existed when floors were unconditional, so this
 * default reproduces the previous behaviour exactly.
 */
export const DEFAULT_FLOOR_MODELS: ReadonlyArray<MoliRuntime.yield_optimization.UprModel> = [
  'static',
  'fixed'
];

/**
 * The model a price rule is treated as when the config endpoint sends none. Mirrors the fallback
 * used for the `upr_model` key-value.
 */
const FALLBACK_MODEL: MoliRuntime.yield_optimization.UprModel = 'static';

/**
 * Resolves the floor price that a price rule may hand to the prebid floors module, or `undefined`
 * if it may not set a floor at all.
 *
 * A price reaches the prebid floors module only when
 *
 * 1. its delivered model is allow-listed in `floorModels` (`static` and `fixed` by default) and
 * 2. the price is greater than zero.
 *
 * The second condition matters on its own: a Google-priced ad unit can deliver a `0` price, and
 * sending `0` as a floor is not the same as sending no floor at all.
 *
 * This says nothing about A9 / Amazon TAM, which deliberately keeps receiving every price rule.
 *
 * @param priceRule the price rule selected for an ad slot
 * @param yieldConfig the *resolved* yield optimization module config (overrides already applied)
 */
export const resolvePrebidFloorPrice = (
  priceRule: MoliRuntime.yield_optimization.PriceRule,
  yieldConfig: modules.yield_optimization.YieldOptimizationConfig | null
): number | undefined => {
  const floorModels = yieldConfig?.floorModels ?? DEFAULT_FLOOR_MODELS;
  return priceRule.floorprice > 0 && floorModels.includes(priceRule.model ?? FALLBACK_MODEL)
    ? priceRule.floorprice
    : undefined;
};
