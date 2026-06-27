import { modules } from 'ad-tag/types/moliConfig';
import { LabelCondition } from 'ad-tag/ads/labelConfigService';

/**
 * Result of resolving a module's label-conditioned configuration overrides.
 */
export interface ResolvedModuleConfig<C> {
  /**
   * The effective module configuration with the `overrides` field stripped. This is what gets
   * passed to the module. Either the first matching override's `config` (full replace) or the
   * default configuration if no override matched.
   */
  readonly config: C;

  /**
   * Index of the matched override in the `overrides` array, or `-1` if no override matched and the
   * default configuration is used.
   */
  readonly matchedOverrideIndex: number;

  /**
   * The selector label condition of the matched override, if any. Useful for debug logging.
   */
  readonly matchedCondition?: LabelCondition;
}

/**
 * Resolves the effective configuration for a module from its default configuration and its ordered
 * list of label-conditioned overrides.
 *
 * The first override whose label condition matches the active labels **fully replaces** the default
 * configuration (no field-by-field merge). If no override matches, the default configuration is used.
 * In both cases the returned `config` has its `overrides` field stripped, so modules never see it.
 *
 * @param base the module configuration as provided by the publisher, possibly carrying `overrides`
 * @param isLabelConditionMet predicate evaluating a label condition against the active labels
 */
export const resolveModuleConfig = <C extends modules.IModuleConfig>(
  base: modules.Overridable<C>,
  isLabelConditionMet: (condition: LabelCondition) => boolean
): ResolvedModuleConfig<C> => {
  const { overrides, ...defaultConfig } = base;

  if (overrides) {
    for (let index = 0; index < overrides.length; index++) {
      const override = overrides[index];
      if (isLabelConditionMet(override)) {
        // full replace: the override's `config` is the bare module config without `overrides`
        return {
          config: override.config,
          matchedOverrideIndex: index,
          matchedCondition: override
        };
      }
    }
  }

  return {
    config: defaultConfig as unknown as C,
    matchedOverrideIndex: -1
  };
};
