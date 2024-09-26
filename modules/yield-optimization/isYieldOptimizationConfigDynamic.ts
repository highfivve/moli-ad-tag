import { DynamicYieldOptimizationConfig, YieldOptimizationConfig } from './index';

/**
 * Type guard function to check if a given `YieldOptimizationConfig` is of type `DynamicYieldOptimizationConfig`.
 *
 * This function helps in narrowing down the type of `YieldOptimizationConfig` to `DynamicYieldOptimizationConfig`
 * by checking the presence of the `dynamicFloorStrategy` property.
 *
 * @param config - The `YieldOptimizationConfig` object to check.
 * @returns `true` if the `config` has a `dynamicFloorStrategy` property, otherwise `false`.
 *
 * @example
 * const config: YieldOptimizationConfig = { ... };
 * if (isYieldConfigDynamic(config)) {
 *   // Now TypeScript knows that `config` is of type `DynamicYieldOptimizationConfig`
 *   console.log(config.dynamicFloorStrategy);
 * }
 */
export const isYieldConfigDynamic = (
  config: YieldOptimizationConfig
): config is DynamicYieldOptimizationConfig => {
  return (config as DynamicYieldOptimizationConfig).dynamicFloorPrices?.strategy !== undefined;
};
