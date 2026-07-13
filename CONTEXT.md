# Context Glossary

This file is a glossary of the domain language used in `@highfivve/ad-tag` (moli).
It contains terms and their precise meanings — no implementation details.

## Terms

### Label
A string tag that may be active during an ad pipeline run. Labels come from media-query
size config, auto-detected device, geo/domain resolution, the `addLabel()` runtime API, and
the `data-labels` script attribute. Labels are immutable within a single pipeline run.

### Label Condition
A predicate over the active labels, expressed as exactly one of `labelAll` (every listed
label active), `labelAny` (at least one active), or `labelNone` (none active).

### Label-Conditioned Config Override
An alternative configuration selected when its Label Condition matches the active labels.
Overrides **fully replace** the default configuration — they do not merge field-by-field. A
config has at most one default plus an ordered list of overrides; the **first** override whose
Label Condition matches wins. If no override matches, the default configuration is used.

Applies to two kinds of configuration:

- **Module config** — entries of `ModulesConfig`. Distinct from the module *activation* gate
  (`labelCondition` on a module config), which only turns a module on or off — an override
  changes *which configuration* an active module runs with.
- **Auction-feature config** — the first-level features of the Global Auction Context
  (`frequencyCap`, `biddersDisabling`, `adRequestThrottling`, `previousBidCpms`,
  `interstitial`, `trackWinningBidder`). Auction features have no activation gate; an override
  with `enabled: false` is the way to turn a feature off for its labels. An override cannot
  exist without a default — overriding a feature that has no base configuration is not
  supported.

### Module

A pluggable feature (`IModule`) with two distinct, independent identity strings — do not
conflate them:

- **`name`** — human-readable display identity, used only in log/debug output. Free-form,
  may contain spaces (e.g. `"Blocklist URLs"`).
- **`configKey`** — the exact key under which the module's configuration lives in
  `ModulesConfig` (e.g. `blocklist`). Typed as `keyof modules.ModulesConfig`, so a mismatch
  is a compile error, not a silent runtime miss. This is the only field used to look up a
  module's configuration.

`name` and `configKey` may differ (e.g. `name: "Blocklist URLs"`, `configKey: "blocklist"`) —
that is expected, not a bug.

### Price Rule
A floor-price candidate for an ad unit, fetched from the yield-optimization service. Has a
`floorprice`, an identifying `priceRuleId`, and a `main` flag. GAM matches the `upr_id`
targeting key sent with an ad request against the corresponding Unified Pricing Rule in GAM to
enforce the floor.

### Main Price Rule
The Price Rule among a slot's fetched candidates whose value actually determines the `upr_id`
sent with the ad request (its floor price, or a dynamically-recalculated price when dynamic
floor pricing is enabled).

### UPR Reset
A yield-optimization module feature that removes the Main Price Rule's floor for an ad unit
path when it appears to be causing a no-fill, so a lower/no-floor request can go out instead.
Enabled by default for all slots; `excludeAdSlotDomIds` opts specific slots out. Once triggered
for an ad unit path — via Empty Refresh — the floor stays reset for the rest of the page
session, regardless of DOM id or SPA navigation. The floor is replaced with a configured
fallback Price Rule if one is set, otherwise `upr_id` is omitted entirely from that ad unit
path's requests from then on.

### Empty Refresh
The UPR Reset trigger that fires after an ad unit path's first ad request in a requestAds cycle
comes back genuinely empty (no fill from GAM): `upr_id` is stripped and the slot is refreshed
once.
