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

### Rewarded Ad
A full-screen ad format the publisher explicitly requests via the `rewardedAd()` runtime API on
a user action, in exchange for granting the user a reward on completion.

### Rewarded Ad Channel
One of the concrete partner integrations capable of serving a Rewarded Ad: `gam` (Google Ad
Manager Rewarded Ads for Web) or `welect` (Welect Ad Chooser). Unlike Interstitial Channel's
generic `c` bucket, each Rewarded Ad Channel names one specific partner integration.

### Rewarded Ad Waterfall
Within a single `rewardedAd()` call, moli attempts each configured Rewarded Ad Channel in
priority order, falling through to the next channel immediately if the current one has no fill.
The call resolves once a channel grants the reward, the user cancels, or every channel is
exhausted.
_Avoid_: priority rotation — that is the Interstitial Channel's session-persisted, cross-page-view
behavior; a Rewarded Ad Waterfall resolves entirely within one call and does not persist state
across calls.

### Rewarded Ad Result
The resolved value of `rewardedAd()`: `granted`, `canceled`, `empty`, or `error`. Every
business outcome, including failure to fill, resolves the promise — the `error` states model
expected conditions like a concurrent call, not exceptions. The promise only rejects on
unexpected technical exceptions, e.g. a crash in an underlying channel integration.

### Welect Token Preflight
An optional check (`checkToken`, default on) that runs before the Rewarded Ad Waterfall when
the `welect` channel is prioritized: a valid existing Welect token — proof the user already
completed a Welect session — short-circuits the whole waterfall to `granted` with the channel's
configured static Reward Payload, without showing an ad on any channel. This avoids re-annoying
users that already earned the reward in this session.

### Reward Payload
The `{ amount: number; type: string }` describing what the user was granted. Mandatory on every
`granted` result, regardless of channel — the `gam` channel supplies it dynamically via its
`rewardedSlotGranted` event; the `welect` channel has no such event, so its payload is a static
value fixed in that channel's configuration. Either way, the publisher always receives the same
payload shape.

### Anchor Channel
One of the two integrations capable of serving a top or bottom Anchor Ad: `gam` (rendered
via GAM's `defineOutOfPageSlot` with `TOP_ANCHOR`/`BOTTOM_ANCHOR`) or `c` (rendered via our
custom sticky header/footer container with prebid demand). Structurally identical to
Interstitial Channel, but governed by a different rotation policy — see Anchor Waterfall.
_Avoid_: conflating with "collapsible anchor ad" — collapsibility is a GAM-UI/line-item
setting applied to the `gam` channel's rendered creative, not a distinct channel or format.

### Anchor Waterfall
Per anchor position — top, bottom-mobile, bottom-desktop are three independent instances,
each with its own session-persisted priority state — moli attempts the current Anchor
Channel and only rotates priority to the back when it returns an empty ad response (GAM) or
no bid (custom/prebid). The winning channel is kept as long as it keeps delivering.
_Avoid_: Interstitial Channel's rotation policy, which shifts on *every* attempt including a
successful GAM render — that exists to work around a GAM-side frequency cap hard-wired to
the Web Interstitial format specifically, which does not apply to anchor formats.
