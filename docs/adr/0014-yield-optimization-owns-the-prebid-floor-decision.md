# 14. Yield optimization owns the prebid floor decision

Date: 2026-10-12

## Status

Accepted

## Context

GD-10492 adds two Google-priced states to the floor price rule engine: Target CPM and Google
Optimized Floors. In both, Google decides the per-query price, so the number our config endpoint
delivers is not a floor we want enforced in the header bidding auction — pushing a target CPM into
prebid as a hard floor would be actively wrong.

The ad tag must therefore stop sending every price rule it receives to the prebid floors module.
GD-10493 introduces `floorModels` on the yield optimization module config: the list of delivered
`upr_model` values that may hand their price to prebid, defaulting to `['static', 'fixed']` so that
every bundle built before this existed keeps behaving identically.

Two things make the placement of that decision non-obvious.

**The delivery alphabet is deliberately lossy.** The GAM custom dimension budget is multiplicative
and the network is tight on it, so the backend's domain alphabet (`static`, `fixed`, `gtc`, `go`,
`disabled`) is collapsed to a delivery alphabet (`static`, `fixed`, `g`, `disabled`) on the wire.
`gtc` and `go` both arrive as `g`. The ad tag is a dumb pipe: it forwards whatever `upr_model` the
config endpoint sends and knows nothing about what is configured in GAM. `floorModels` is expressed
in delivery values precisely so a publisher can later be given header bidding floors on
Google-priced inventory without the ad tag learning anything new.

**A9 is deliberately unaffected.** `a9.ts` keeps reading `priceRule.floorprice` for publishers with
`enableFloorPrices`, so a target CPM will reach Amazon TAM as a hard floor even though prebid
correctly skips it. That is a known, accepted gap, not an oversight. Whatever carries the decision
must therefore reach prebid *without* reaching A9, even though both read the same `SlotDefinition`.

## Decision

### The module decides; `prebid.ts` reads a number

`SlotDefinition` gains `prebidFloorPrice?: number` next to the existing `priceRule`. The yield
optimization module's `prepareRequestAds` step sets both: `priceRule` as before, and
`prebidFloorPrice` to `priceRule.floorprice` only when the rule is allowed to produce a floor.
`undefined` means "no floor for prebid", which is **not** the same as a floor of `0`.

`createdAdUnits` in `prebid.ts` emits a `floors` block iff `prebidFloorPrice !== undefined`. It
never sees `upr_model`, `floorModels`, or the yield optimization config. A9 is untouched and keeps
reading `priceRule.floorprice`.

The predicate itself lives in `ads/modules/yield-optimization/floorModels.ts` as
`resolvePrebidFloorPrice(priceRule, yieldConfig)`, which returns the price or `undefined`. Ordering
is already guaranteed: the yield step is `HIGH_PRIORITY` (100), `prebid-prepare-adunits` is
`LOW_PRIORITY` (10), and steps run in descending priority.

### Rejected: `prebid.ts` reads the yield optimization config itself

The obvious alternative — have `createdAdUnits` read `context.config__.modules.yieldOptimization`
and apply `floorModels` there — was implemented first and then withdrawn. It breaks
[ADR 0001](./0001-label-conditioned-module-config-overrides.md) in two ways:

- `ModulesConfig` entries are `Overridable<>`, and ADR 0001 fixes override resolution as "central,
  in `moli.ts`, one-time at configure". `createdAdUnits` runs on *every* `prepareRequestAds`,
  including SPA navigations, so resolving overrides there would re-resolve per ad request. Labels
  added between navigations would make the prebid floor gate follow a different override than the
  yield optimization module is itself running with — the two would silently disagree.
- Reading the raw entry without resolving would be worse: it ignores overrides, the `enabled` flag
  and the `labelCondition` activation gate that `moli.ts` applies.

Keeping the decision in the module means it is made once, from the already-resolved config the
module was handed, and core never reads a named module's config. This follows the ownership split
of ADR 0012 and ADR 0013: a module owns its concern end to end rather than core growing
module-specific branches.

## Consequences

- No publisher-visible change: absent `floorModels`, `static` and `fixed` still send their price.
- A price of `0` no longer produces `floors.values['*'] = 0`; the `floors` block is omitted
  entirely. For an ad unit that previously overrode a global `prebid.config.floors` with `0`, the
  global floor data now applies instead. No current model delivers `0` — only the not-yet-shipped
  Google Optimized state does — but it is a behaviour difference, not a pure no-op.
- `MoliRuntime.yield_optimization.UprModel` is the delivery alphabet. The dead `ml` value is gone.
  `validateRules` in `yieldOptimizationService.ts` does not validate `model` at runtime, so an
  endpoint delivering an unknown value simply fails the allow-list and sends no floor; the module
  logs that at debug level rather than failing.
- A module that wants to influence prebid ad units now has a precedent for doing it through a
  `SlotDefinition` field rather than through core reading its config.
