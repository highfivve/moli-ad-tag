# 2. Label-conditioned auction-feature config overrides

Date: 2026-06-27

## Status

Accepted

Extends [0001-label-conditioned-module-config-overrides](./0001-label-conditioned-module-config-overrides.md).

## Context

ADR 0001 gave **module** configs label-conditioned overrides and explicitly scoped itself
"Module configs only. Slots/sizes/prebid/targeting out of scope." We now want the same
capability for the first-level features of the Global Auction Context
(`auction.GlobalAuctionContextConfig`): `frequencyCap`, `biddersDisabling`,
`adRequestThrottling`, `previousBidCpms`, `interstitial`, `trackWinningBidder`.

The auction-feature configs differ from module configs in two ways that drive the decisions
below:

1. `createGlobalAuctionContext` (`ads/globalAuctionContext.ts`) reads each feature config
   **directly** (`config.frequencyCap?.enabled`) to decide whether to build the feature and
   whether to register its event listeners. Module configs are opaque to the resolver.
2. The Global Auction Context is built inside `adService.initialize`, which does not currently
   have the `labelService` that module resolution uses in the `moli.ts` configured-state loop.

This is a public-API extension (published to npm, documented from `types/moliConfig.ts`,
validated against the generated `schema.json`), so the shape decisions are expensive to
reverse.

## Decision

### Type shape: reuse the `Overridable<C>` wrapper per feature (not a separate `overrides` block)

Each first-level feature is wrapped, exactly as modules are:

```ts
export interface GlobalAuctionContextConfig {
  readonly frequencyCap?: Overridable<FrequencyCappingConfig>;
  readonly biddersDisabling?: Overridable<BidderDisablingConfig>;
  readonly adRequestThrottling?: Overridable<AdRequestThrottlingConfig>;
  readonly previousBidCpms?: Overridable<PreviousBidCpmsConfig>;
  readonly interstitial?: Overridable<InterstitialConfig>;
  readonly trackWinningBidder?: Overridable<TrackWinningBidderConfig>;
}
```

We rejected a separate per-feature `overrides` block
(`overrides?: { frequencyCap?: ReadonlyArray<LabelCondition & { config: ... }> }`). The
Global Auction Context config is structurally the same as `ModulesConfig` — a flat object of
named optional feature configs — so there is no reason to introduce a second shape for the
same concept. The separate block would also duplicate feature keys, split a feature's default
from its overrides, and permit an **override without a base config**, which we do not want.

All six features are wrapped uniformly, including the trivial `{ enabled }`-only ones
(`previousBidCpms`, `trackWinningBidder`). Auction features have no `labelCondition`
activation gate, so an override is the only way to get label-conditional behavior — including
label-conditional enable/disable. Wrapping some but not all would invite "why can't I override
X?".

### Replacement semantics: full replace (inherited from 0001)

A matching override's `config` fully replaces the feature default — no field merge. An
override with `enabled: false` disables the feature for its labels. Because auction features
have no separate activation gate, this is the intended off-switch.

### Resolver: hoist `Overridable<C>` and generalize the resolver, reuse for both

`Overridable<C>` is moved out of the `modules` namespace to a shared location (it is purely
structural, `C & { overrides? }`). `resolveModuleConfig` is generalized — the
`C extends IModuleConfig` bound is dropped (it was never load-bearing for the resolve logic)
and the function renamed `resolveOverridableConfig`. Both module resolution and auction-feature
resolution call it. The `labelCondition` activation gate accessed after module resolution still
typechecks because `C` is inferred per call site.

### Resolution location: inside `createGlobalAuctionContext`, via an injected predicate

`createGlobalAuctionContext` gains an `isLabelConditionMet` predicate parameter. At the top of
the function each feature is resolved once
(`const frequencyCap = resolveOverridableConfig(config.frequencyCap, pred)`), and the resolved
locals are used **everywhere** below — both the per-feature build and the event-listener
registration gates (the existing `config.X?.enabled` reads all switch to the resolved locals,
or a label-selected override would fail to wire its listeners). The resolver strips the
`overrides` field, so the feature factories never see it.

We rejected resolving in the `moli.ts` loop and threading a cloned `MoliConfig` into
`initialize` (mutating/cloning a readonly config), and rejected resolving in `initialize`
before the build (predicate still has to be threaded, but the feature reads stay in the GAC).
Letting the Global Auction Context own resolution keeps the predicate threading shallow
(`moli.ts` loop → `adService.initialize` → `createGlobalAuctionContext`) and keeps all feature
reads in one place.

The two placeholder/test call sites of `createGlobalAuctionContext` (no config) pass a trivial
`() => false` predicate — there are no overrides to resolve.

### Resolution timing: one-time at initialize

Resolution runs once, when the Global Auction Context is built in `adService.initialize`. SPA
navigations call `requestAds` directly and never rebuild the Global Auction Context, so the
selected overrides are fixed for the page lifetime. This is structural (not a configurable
knob) and matches module resolution.

### Debug logging

On a match, log at debug: feature name, matched override index, selector condition — mirroring
module override logging.

## Consequences

- `Overridable<C>` moves namespace (structural type; emitted `schema.json` shape unchanged;
  publishers write JSON, not TS imports, so no consumer break).
- `createGlobalAuctionContext` gains a predicate parameter; all internal `config.X` reads
  switch to resolved locals.
- Override configs for auction features are fully schema-validated; nesting is structurally
  impossible (same wrapper guarantee as 0001).
- Override selection is fixed at the first ad request; per-SPA-navigation swapping is not
  supported.
- Overriding a feature with no base configuration is not supported.
- Regenerate `schema.json` (`npm run schema`) after wrapping the entries.
