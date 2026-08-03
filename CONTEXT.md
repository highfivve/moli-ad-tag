# Context Glossary

This file is a glossary of the domain language used in `@highfivve/ad-tag` (moli).
It contains terms and their precise meanings — no implementation details.

## Terms

### Label
A string tag that may be active during an ad pipeline run. Labels come from media-query
size config, auto-detected device, geo/domain resolution, the `addLabel()` runtime API, the
`data-labels` script attribute, the `moliLabels` query parameter (comma-separated), and the
`moli-labels` localStorage entry (JSON string array) — the latter two are debug-only inputs
managed via the debug console's "Debug Labels" section. Labels are immutable within a single
pipeline run.

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

### Client Type
The kind of client the embedding app reports the page is running in — `web`, `pwa`, `android`, or
`ios` — originating outside moli (e.g. gutefrage's NMMS). moli has no first-class Client Type field:
the app expresses it as a [Label] (`ios`/`android`) that selects a [Label-Conditioned Config
Override], and separately as key-values (`advertising_id`, keywords) that a module reads from
targeting. `web`/`pwa` are the default — no override, so no label needed.
_Avoid_: os (the emetriq `os` field is *derived* from Client Type, not the same thing); device
(device is `mobile`/`desktop`, an orthogonal axis).

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

When `gam` is the active channel for a position, the `c` channel's own container (sticky
header for top, sticky footer for bottom) must stay hidden for that position, since GAM is
already serving that anchor slot out-of-page. The container treats an active `gam` channel
the same way it treats a disallowed advertiser on its own render: as a reason to hide.

### Anchor Waterfall
Per anchor position — top, bottom-mobile, bottom-desktop are three independent instances,
each with its own session-persisted priority state — moli attempts the current Anchor
Channel and only rotates priority to the back when it returns an empty ad response (GAM) or
no bid (custom/prebid). The winning channel is kept as long as it keeps delivering.
_Avoid_: Interstitial Channel's rotation policy, which shifts on *every* attempt including a
successful GAM render — that exists to work around a GAM-side frequency cap hard-wired to
the Web Interstitial format specifically, which does not apply to anchor formats.

### Position
The ad slot's configured shape (`in-page`, `anchor-bottom`, `out-of-page-top-anchor`, etc.) —
fixed at config time, never changes at runtime. _Avoid_: confusing with Format Targeting
Value, which describes how a Position actually got rendered this cycle and can vary.

### Format Targeting Value
The raw value carried by GAM's `format` (`f`) key-value targeting on a live ad slot: either
GPT's own `OutOfPageFormat` enum number (the slot was defined as a native GAM out-of-page
format) or one of moli's custom sentinel constants (used when the same Position is instead
rendered through moli's own custom/prebid-backed path rather than a native GAM out-of-page
call — e.g. an Anchor Ad on the `c` Channel). Two slots can share the same Position yet carry
different Format Targeting Values; that's precisely the distinction it exists to capture.
_Avoid_: treating this as just another name for Position — it answers "how was this rendered,"
not "what shape was configured."

### Viewability Override
A per-slot-domId override of what element to monitor for on-screen visibility, in place of
the slot's own container div. A domId maps to an ordered list of override entries; the first
entry whose Viewability Override Condition matches — or that has no condition at all — wins
outright. No matching entry, or the matched entry's target element not being present in the
DOM, means the slot's own div is monitored instead.
_Avoid_: treating the list as a merge — like Label-Conditioned Config Override, the winning
entry replaces, it does not blend with the others.

### Viewability Override Condition
A predicate on a single Viewability Override entry, currently only a `format` field compared
against the slot's live Format Targeting Value. Multiple fields on one condition are ANDed
together; OR is expressed by adding another entry to the list, not by the condition itself.

### Inline AI Integration Mode
One of `auto`, `programmatic`, or `hybrid` — configured explicitly on the InlineAI module
config, mirroring the three integration modes the InlineAI SDK itself supports. Determines
whether the module touches the [Inline AI Placement] list at all:
- **auto**: hard bypass. The module only loads the InlineAI script. It never reads the
  placements list, evaluates a [Placement Label Condition], or pushes any command queue
  entries — the InlineAI dashboard owns all rendering.
- **programmatic**: pushes `['init', { publisherId }]` onto the InlineAI command queue, then
  pushes a `['mount', ...]` entry for every placement whose Placement Label Condition matches.
- **hybrid**: does **not** push `init()` (that would flip the InlineAI SDK itself into
  programmatic mode and disable its dashboard auto-rendering). Still pushes `['mount', ...]`
  for every matching placement, layering explicit placements on top of the dashboard's
  auto-rendered ones.
_Avoid_: confusing this with the InlineAI SDK's own mode detection (which mode it ends up in
is a side effect of what the module pushes, not a separate switch) — see [Inline AI Command
Queue].

### Inline AI Command Queue
The `window.InlineAI.cmd` array the module sets up (`window.InlineAI = window.InlineAI || {};
window.InlineAI.cmd = window.InlineAI.cmd || [];`) before loading the InlineAI script, then
pushes entries onto per the active [Inline AI Integration Mode]. Distinct from moli's own
command queue (`window.moli.que`, drained by `moliGlobal.ts`) — the InlineAI script drains its
*own* queue itself once loaded; the module never drains anything.

### Inline AI Placement
One entry in the module's configured placements list: one of the seven InlineAI placement
types (`widget`, `search-fab`, `search-embed`, `search-icon`, `key-takeaways`,
`single-question`, `basic-embed`), each with its own `name` (our own free-form identifier for
logging/debugging — distinct from moli's `domId`, since a placement's DOM target is a separate
`containerId`/`selector`/`dynamic` field, not an id we assign) and an optional [Placement Label
Condition]. Only consulted in `programmatic` and `hybrid` [Inline AI Integration Mode] — never
in `auto`.

### Placement Label Condition
A [Label Condition] on an [Inline AI Placement], evaluated against the ad pipeline's active
Labels. The module itself does **not** inject a mode label — if a publisher wants to scope a
placement to one [Inline AI Integration Mode] (`labelAll: ['hybrid']`), that label is set up as
a static label in the highfivve portal, the same mechanism as any other label-conditioned
config, rather than a bespoke mode-only field.

### Inline AI SPA Re-run
On non-SPA setups the module applies its [Inline AI Integration Mode] once, in an init step.
On SPA setups (`spa.enabled` in the moli config) it instead uses a configure step that re-runs
once per `requestAds()` cycle, since placements need to be re-mounted for the new page. The
first cycle (`requestAdsCalls__ === 1`) pushes `['init', ...]`/`['mount', ...]` straight away;
every later cycle first pushes `['destroy']` to tear down the previous run's placements before
re-applying the mode - see `docs/inline/init.md`. The InlineAI script itself still loads only
once, regardless of how many cycles run.
