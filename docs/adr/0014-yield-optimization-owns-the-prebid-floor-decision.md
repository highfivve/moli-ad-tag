# 14. Yield optimization owns the prebid floor decision

Date: 2026-10-12

## Status

Accepted, amended — see [Amendment](#amendment-the-decision-moved-server-side) below. The
decision in this ADR still holds: the yield optimization module owns the prebid floor and
`prebid.ts` reads a number. Its *reasoning* no longer does — there is no module config left to
resolve, because `floorModels` is gone from the publisher config and the floor is chosen by the
server. Read the Amendment before acting on the Decision.

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

## Amendment: the decision moved server-side

The yield-optimization backend now decides the prebid floor and sends it. See ADR 0003 in
`gd/yield-optimization`, *The header bidding floor is a price on the change, not a flag in the ad
tag*.

What changed:

- **`floorModels` is no longer publisher config.** It was policy, and policy moved to the backend,
  where it is an authored price on the Yield Config Change. Leaving a per-publisher list in the
  bundle meant the bundle could silently veto a floor the yield engine had just authored, and that
  flipping a publisher's mind required a rebuild and a deploy.
- **`floorModels` is still sent, as a capability list** in the config request: the delivery values
  this bundle understands, a constant rather than a setting. Its presence tells the server the
  bundle tolerates an absent `floorprice`; a request without it gets the old wire shape.
- **`PriceRule.floorprice` is optional and `PriceRule.pbFloor` is new.** `floorprice` carries the
  price ladder rung for `static` and `fixed` and is absent for Google-priced rules; `pbFloor`
  carries the floor authored for a Google-priced rule. The module sets
  `slot.prebidFloorPrice = rule.pbFloor ?? rule.floorprice` — `??`, not `||`, so a `0` would
  surface as a bug rather than vanish.
- **`floorModels.ts` and `resolvePrebidFloorPrice` are deleted**, and with them the
  `price > 0` guard. A rule that must not floor prebid now simply arrives with neither field.
- **`validateRules` must accept an absent `floorprice`.** It validates with `every`, so one rule
  missing the field rejects the entire response and the publisher loses `upr_id` targeting on every
  ad unit. This is why the server keeps the old shape for requests without `floorModels`.
- **A9 is no longer unaffected, and that is the point.** It reads `floorprice`, which is now absent
  for Google-priced rules, so a target CPM stops reaching Amazon TAM as a hard floor. The "known,
  accepted gap" in the Context above is closed. `a9.ts` must gate on `floorprice !== undefined`
  rather than on the presence of a `priceRule`, or `undefined` reaches `Math.ceil` and ships `NaN`.
- **`dynamicFloorPrice` is restricted to `static` and `fixed`.** It rewrites `priceRuleId` into a
  price ladder rule id, which is only what `upr_id` means for those two models; on a Google-priced
  rule it would overwrite a target CPM or the Google Optimized `0` with a value matching no pricing
  rule at all. Within `static` and `fixed` nothing else is needed: those rules carry `floorprice`
  and no `pbFloor`, so the rewritten price reaches prebid through the same chain.

What did **not** change: `SlotDefinition.prebidFloorPrice` stays, `prebid.ts` still emits a floors
block iff it is defined and still never sees `upr_model`, and the yield module still sets it. The
module remains the single place that knows how a price rule becomes a prebid floor — now because
`prebid.ts` should not learn the response schema, and because `dynamicFloorPrice` rewrites
`floorprice` in the module and the chain has to be read after that.
