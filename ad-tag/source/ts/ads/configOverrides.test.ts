import { expect } from 'chai';

import { resolveOverridableConfig } from './configOverrides';
import { LabelCondition } from './labelConfigService';
import { modules, Overridable } from '../types/moliConfig';

describe('resolveOverridableConfig', () => {
  // a simple module config type for testing
  interface TestModuleConfig extends modules.IModuleConfig {
    readonly value: string;
  }

  /**
   * Builds an `isLabelConditionMet` predicate that evaluates a label condition against a fixed set
   * of active labels - mirrors the real labelConfigService implementation.
   */
  const labelMatcher =
    (activeLabels: string[]) =>
    (condition: LabelCondition): boolean => {
      const labels = new Set(activeLabels);
      if ('labelAll' in condition) {
        return condition.labelAll.every(label => labels.has(label));
      }
      if ('labelAny' in condition) {
        return condition.labelAny.some(label => labels.has(label));
      }
      return condition.labelNone.every(label => !labels.has(label));
    };

  it('returns the default config and index -1 when there are no overrides', () => {
    const base: Overridable<TestModuleConfig> = {
      enabled: true,
      value: 'default'
    };

    const result = resolveOverridableConfig(base, labelMatcher([]));

    expect(result.config).to.deep.equal({ enabled: true, value: 'default' });
    expect(result.matchedOverrideIndex).to.equal(-1);
    expect(result.matchedCondition).to.be.undefined;
  });

  it('returns the default config when no override matches', () => {
    const base: Overridable<TestModuleConfig> = {
      enabled: true,
      value: 'default',
      overrides: [
        { labelAll: ['article'], config: { enabled: true, value: 'article' } },
        { labelAny: ['video'], config: { enabled: true, value: 'video' } }
      ]
    };

    const result = resolveOverridableConfig(base, labelMatcher(['home']));

    expect(result.config).to.deep.equal({ enabled: true, value: 'default' });
    expect(result.matchedOverrideIndex).to.equal(-1);
  });

  it('fully replaces the default config with the first matching override', () => {
    const base: Overridable<TestModuleConfig> = {
      enabled: true,
      value: 'default',
      overrides: [{ labelAll: ['article'], config: { enabled: true, value: 'article' } }]
    };

    const result = resolveOverridableConfig(base, labelMatcher(['article']));

    expect(result.config).to.deep.equal({ enabled: true, value: 'article' });
    expect(result.matchedOverrideIndex).to.equal(0);
    expect(result.matchedCondition).to.deep.equal({
      labelAll: ['article'],
      config: { enabled: true, value: 'article' }
    });
  });

  it('picks the first matching override when several match (first match wins)', () => {
    const base: Overridable<TestModuleConfig> = {
      enabled: true,
      value: 'default',
      overrides: [
        { labelAny: ['video'], config: { enabled: true, value: 'video' } },
        { labelAll: ['article'], config: { enabled: true, value: 'article' } }
      ]
    };

    // both conditions match - the first entry must win
    const result = resolveOverridableConfig(base, labelMatcher(['video', 'article']));

    expect(result.config).to.deep.equal({ enabled: true, value: 'video' });
    expect(result.matchedOverrideIndex).to.equal(0);
  });

  it('full replace drops default-only fields not present in the override config', () => {
    const base: Overridable<TestModuleConfig> = {
      enabled: true,
      value: 'default',
      // override config omits `value` - full replace must not carry it over
      overrides: [{ labelAll: ['minimal'], config: { enabled: true } as TestModuleConfig }]
    };

    const result = resolveOverridableConfig(base, labelMatcher(['minimal']));

    expect(result.config).to.deep.equal({ enabled: true });
    expect((result.config as Partial<TestModuleConfig>).value).to.be.undefined;
  });

  it('allows an override to disable the module via enabled: false', () => {
    const base: Overridable<TestModuleConfig> = {
      enabled: true,
      value: 'default',
      overrides: [{ labelAny: ['no-module'], config: { enabled: false, value: 'off' } }]
    };

    const result = resolveOverridableConfig(base, labelMatcher(['no-module']));

    expect(result.config.enabled).to.be.false;
    expect(result.matchedOverrideIndex).to.equal(0);
  });

  it('strips the overrides field from the default config so modules never see it', () => {
    const base: Overridable<TestModuleConfig> = {
      enabled: true,
      value: 'default',
      overrides: [{ labelAll: ['x'], config: { enabled: true, value: 'x' } }]
    };

    const result = resolveOverridableConfig(base, labelMatcher([]));

    expect(result.config).to.not.have.property('overrides');
  });
});
