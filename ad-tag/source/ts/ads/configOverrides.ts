import { Overridable } from 'ad-tag/types/moliConfig';
import { LabelCondition } from 'ad-tag/ads/labelConfigService';

/**
 * Result of resolving a label-conditioned configuration override.
 */
export interface ResolvedOverridableConfig<C> {
  /**
   * The effective configuration with the `overrides` field stripped. This is what gets passed to the
   * consumer (module or auction feature). Either the first matching override's `config` (full
   * replace) or the default configuration if no override matched.
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
 * Resolves the effective configuration from a default configuration and an ordered list of
 * label-conditioned overrides.
 *
 * The first override whose label condition matches the active labels **fully replaces** the default
 * configuration (no field-by-field merge). If no override matches, the default configuration is used.
 * In both cases the returned `config` has its `overrides` field stripped, so consumers never see it.
 *
 * Used for both module configs and Global Auction Context feature configs.
 *
 * @param base the configuration as provided by the publisher, possibly carrying `overrides`
 * @param isLabelConditionMet predicate evaluating a label condition against the active labels
 */
export const resolveOverridableConfig = <C>(
  base: Overridable<C>,
  isLabelConditionMet: (condition: LabelCondition) => boolean
): ResolvedOverridableConfig<C> => {
  const { overrides = [], ...defaultConfig } = base;

  const matchedOverrideIndex = overrides.findIndex(isLabelConditionMet);
  const match = overrides[matchedOverrideIndex];

  // full replace: the matched override's `config` is the bare config without `overrides`
  return match
    ? { config: match.config, matchedOverrideIndex, matchedCondition: match }
    : { config: defaultConfig as unknown as C, matchedOverrideIndex: -1 };
};
