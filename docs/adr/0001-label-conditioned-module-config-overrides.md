# 1. Label-conditioned module config overrides

Date: 2026-06-27

## Status

Accepted

## Context

Modules already support label-based *activation* (`IModuleConfig.labelCondition`),
which only turns a module on or off. We want a module to run with a **different
configuration** depending on the active labels: a default configuration plus a set of
alternatives, each selected by a label condition. The first matching alternative wins;
if none match, the default is used. Triggers are the existing label sources —
`addLabel()` and the `data-labels` script attribute.

Several design choices had genuine alternatives and are expensive to reverse, because
the module configuration is a public API: it is published to npm, documented from
`types/moliConfig.ts`, and validated against the generated `schema.json`.

## Decision

### Replacement semantics: full replace

A matching override **fully replaces** the module's default configuration. No
field-by-field merge. This matches the "replace with a specific one" intent and avoids
merge-ambiguity (array concat-vs-replace, nested objects, `undefined` meaning).

### Type shape: generic wrapper at `ModulesConfig`, not inheritance

```ts
export interface IModuleConfig {
  readonly enabled: boolean;
  readonly labelCondition?: LabelCondition;
}

export type Overridable<C> = C & {
  readonly overrides?: ReadonlyArray<LabelCondition & { readonly config: C }>;
};

// ModulesConfig — every entry wrapped:
readonly adReload?: Overridable<adreload.AdReloadModuleConfig>;
```

The override's `config` is the bare module config type `C`, which has **no** `overrides`
field — so override nesting is structurally impossible without an `Omit`.

We rejected the alternative of baking overrides into the base via a self-referential
generic (`interface XConfig extends IModuleConfig<XConfig>` with
`config: Omit<Self, 'overrides'>`). It typechecks, but **`ts-json-schema-generator`
2.3.0 silently collapses `Omit<Self, …>` over a generic type parameter to an empty
`{ type: object, additionalProperties: false }`** — i.e. override configs would receive
**zero schema validation**. Verified empirically. The non-`Omit` self-referential form
validates correctly but permits infinite override nesting. The wrapper gives full
validation *and* no nesting.

Trade-off accepted: a new module's `ModulesConfig` entry must be wrapped in
`Overridable<>` by hand (not enforced by inheritance). Documented.

### Resolution: central, in `moli.ts`, one-time at configure

Override resolution happens in the existing module-configure loop
(`requestAds`, `configured` state, moli.ts ~333–400) — the only place modules are
configured and their pipeline steps registered. Modules are **not** changed; they
receive an already-resolved `ModulesConfig` and never see `overrides`.

Resolution is **one-time**, at the first ad request. SPA navigations
(`spa-requestAds`) do not re-run `configure__`, so module config is fixed for the page
lifetime. This matches the current module lifecycle and the triggers (`data-labels` and
pre-configure `addLabel`). Per-navigation re-resolution was rejected: it would require
reconfiguring and rebuilding steps for ~20 modules that are not designed to be
reconfigured.

### Two orthogonal label concepts

1. **Override selector** — the `LabelCondition` on each override entry; picks *which*
   config. First match wins (array order).
2. **Activation gate** — `labelCondition` on the *resolved* config; gates the module
   on/off (existing behavior).

Both evaluated by the existing `isLabelConditionMet`. A `labelCondition` set *inside* an
override config still acts as a gate but is normally pointless there; documented to
leave it unset. An override config may set `enabled: false` to disable the module for
its labels (consequence of full replace).

### Algorithm

```
base = config.modules[name]
if (!base) skip
effective = base
if (base.overrides?.length) {
  match = base.overrides.find(o => isLabelConditionMet(<selector of o>))
  if (match) effective = match.config       // full replace
}
if (effective.labelCondition && !isLabelConditionMet(effective.labelCondition)) skip
module.configure__({ ...config.modules, [name]: effective })   // overrides stripped
```

On a match, log at debug: module name, matched override index, selector condition.

### Scope

Module configs only. Slots/sizes/prebid/targeting are out of scope; slots and sizes
already have their own label filtering.

## Consequences

- One new wrapper type; ~20 `ModulesConfig` entries wrapped; one resolver added to the
  existing loop. Module implementations untouched.
- Override configs are fully schema-validated.
- New modules must remember to wrap their entry in `Overridable<>`.
- Override selection is fixed at first ad request; per-SPA-navigation override swapping
  is explicitly not supported.
- Regenerate `schema.json` (`npm run schema`) after adding the wrapper.
