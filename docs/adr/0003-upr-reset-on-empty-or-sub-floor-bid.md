# 3. UPR Reset on empty or sub-floor bid

Date: 2026-07-10

## Status

Accepted

## Context

Floor prices (Price Rules, enforced via the `upr_id` GAM targeting key) sometimes cause a slot
to no-fill when a real bid exists that would have filled at a lower price. We want a
yield-optimization feature — **UPR Reset** — that detects this and removes the floor so the
slot fills instead of going empty. See `CONTEXT.md` for the Price Rule / Main Price Rule /
Empty Refresh glossary entries this ADR assumes.

Several shape and default decisions here directly affect ad revenue and are expensive to
reverse once publishers depend on them.

## Decision

### Module home: yield-optimization module, not a new module or ad-reload

UPR Reset is config on the existing yield-optimization module, not a standalone module. That
module already owns Price Rule computation and `upr_id` targeting (`setTargeting`), so floor-
clearing logic stays next to floor-setting logic. Rejected: a new standalone module (would need
to override/race with yield-optimization's own targeting writes every cycle) and folding it
into the ad-reload module (which knows nothing about floors/Price Rules today — would invert
ownership).

Consequence: yield-optimization module registers its **own** `slotRenderEnded`/`isEmpty`
listener for Empty Refresh and calls the public `moli.refreshAdSlot` API directly. This works
regardless of whether the ad-reload module is installed — no cross-module dependency.

### Config source: static `moliConfig.ts`, not fetched with the Price Rule

UPR Reset config is authored statically alongside other yield-optimization module config, like
the ad-reload module's config. It is **not** a field on the externally-fetched `PriceRule`
payload. This keeps the feature independent of the external floor-price service/schema and lets
it apply uniformly regardless of which Price Rule a slot ends up with.

### Default: opt-out (`excludeAdSlotDomIds`), not opt-in

UPR Reset is enabled for all slots by default; publishers list DOM ids to exclude, matching the
ad-reload module's existing include/exclude convention. Considered but rejected: an opt-in
allowlist (`includeAdSlotDomIds`) — safer given the revenue impact, but inconsistent with the
established module convention and requires every slot to be explicitly enrolled.

### Reset value: optional single global `fallbackPriceRuleId`

One config field covers both of the originally-requested behaviors: if `fallbackPriceRuleId` is
set, that Price Rule's `upr_id` is sent instead of the removed one (e.g. a real 0.01-floor rule
provisioned in GAM); if unset, the `upr_id` key is omitted entirely. Rejected a per-slot/domId
map of fallback rules — no requirement surfaced for different fallback rules per slot, and a
single value is simpler to reason about and configure.

### Single trigger: Empty Refresh

If the first ad request in a requestAds cycle comes back genuinely empty
(`slotRenderEnded.isEmpty`), strip `upr_id` and refresh the slot once via `moli.refreshAdSlot`.
If that retry is also empty, stop — no further retries this cycle. Scoped per requestAds cycle
and SPA-aware: re-evaluates on every cycle (initial load or a later SPA navigation), not just
the page's first-ever `requestAds()` call.

#### Rejected: a second, pre-emptive Floor Bypass trigger

A second trigger was prototyped: at bids-back time, before the first ad request of a cycle, if
the highest real Prebid bid (cpm > 0) for a slot was below the Main Price Rule's effective floor
(post dynamic-price-calc), strip `upr_id` pre-emptively — no wasted ad-request roundtrip.

Rejected after review: Prebid demand does not represent enough of a slot's total addressable
revenue (direct/programmatic-guaranteed and other non-Prebid demand bypass this comparison
entirely) to justify giving up the floor on the evidence of one low Prebid bid alone. Doing so
risks discarding a floor that a real, higher-value non-Prebid buyer would have cleared, on the
basis of a comparison that only reflects Prebid's share of demand. Empty Refresh only gives up
the floor once GAM has already returned a genuine no-fill for **all** demand sources — a much
safer signal to act on. This trades a wasted ad-request roundtrip (Floor Bypass would have
avoided) for correctness.

### State: sticky per ad unit path for the rest of the session

Once Empty Refresh triggers for an ad unit path, that ad unit path stays floor-reset for the
rest of the page session — not just the cycle that triggered it, and not reset on the next SPA
navigation. Keyed by **ad unit path**, not DOM id, since the floor/Price Rule concept is
ad-unit-path-scoped and a DOM id can be reused across SPA navigations for genuinely different
content. Rejected: one-shot-per-cycle (floor reverts to normal on the next independent cycle) —
we want "this ad unit consistently can't clear its floor, stop trying" rather than re-litigating
it every navigation.

### Observability: debug log only

Log at debug on trigger (ad unit path, floor removed/fallback used) mirroring the module-logging
conventions already in place. No new analytics event type in v1.

## Consequences

- New `uprReset` config on the yield-optimization module: `excludeAdSlotDomIds`,
  `fallbackPriceRuleId?`.
- Yield-optimization module gains its own `slotRenderEnded` listener, independent of the
  ad-reload module.
- Internal sticky-reset state is keyed by ad unit path and lives for the page session; it is
  not exposed as a configurable per-slot map.
- No retry beyond one Empty Refresh per cycle; a slot that stays empty after that is left empty
  until the next cycle (which, per the sticky rule, no longer has a floor to reset anyway).
- Once an ad unit path is reset, `upr_main` is always removed alongside `upr_id` (regardless of
  fallback vs. omitted), since `upr_id` no longer reflects the Main Price Rule - leaving
  `upr_main: true` set would skew reporting.
- Regenerate `schema.json` (`npm run schema`) after adding the `uprReset` config type.
