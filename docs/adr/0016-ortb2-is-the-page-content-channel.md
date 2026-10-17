# 16. ortb2 is moli's page-content channel

Date: 2026-10-17

## Status

Accepted

## Context

GD-10506 needs the question title and the asker's nickname of a gutefrage QDP to reach an ad
creative so it can render a personalised native post. Two things have to happen: the values have to
travel from the page into the ad tag, and a creative inside an ad iframe has to be able to read
them back.

The obvious home was `targeting.keyValues` plus `targeting.adManagerExcludes` — put the values in
as key-values, then exclude them from the Google Ad Manager call so they don't become GAM
targeting keys.

That does not do what the name suggests. `adManagerExcludes` gates exactly one consumer: the
`setConfig`/`setTargeting` path into GAM. Every other consumer of `keyValues` reads the map
directly and never looks at the exclude list:

- `modules/adex` merges key-values into its page call
- `modules/emetriq` merges key-values into its `custom` parameters
- `modules/roqad` merges key-values into the cookie sync parameters
- `modules/prebid-first-party-data` reads key-values for its IAB category mappings

So a question title and a user's nickname placed in `keyValues` would be sent to three data
partners as anonymous, untyped strings under whatever key the publisher chose — unlabelled, and
with no way for the receiving side to know what the value is. `adManagerExcludes` would have made
that look deliberate and contained when it is neither.

A second problem is size. The personalisation payload is a full question headline. GAM key-values
are capped and a headline routinely exceeds what is sensible there, which is why the creative has
to pull the data from the page at render time rather than receive it as a macro.

## Decision

### ortb2 is a first-class targeting field

`googleAdManager.Targeting` gains an optional `ortb2` field holding an OpenRTB 2.6 first-party-data
object, and `moli.setConfig({ ortb2 })` supplies the per-page half at runtime.
`moli.getPageTargeting().ortb2` returns the two deep merged.

ORTB gives every field a standard, named home: `site.content.title` is the content headline,
`site.content.producer.name` is the entity that produced it. A partner receiving
`site.content.title` knows what it is holding; a partner receiving `kv_qtitle` does not. `Content`
and `Producer` are typed in `types/prebidjs.ts` accordingly — `Producer` was previously missing.

This is page *content*, not page *targeting*. Key-values stay what they are: short, GAM-shaped
targeting signals. Page content goes in `ortb2`.

Two homes in that sentence look wrong and are deliberate. The field sits on
`googleAdManager.Targeting` although it is the one field that must *not* reach Google Ad Manager:
that type is moli's page-level targeting bag, the thing `getPageTargeting()` returns, and
splitting page content into a second top-level config section would make publishers reason about
two places where page-level data lives. Its *type* comes from `prebidjs.firstpartydata` although a
publisher may run no prebid at all: that namespace is simply where this repo already types OpenRTB
2.6, and duplicating `Site`/`Content`/`User` under a neutral namespace would leave two definitions
of the same spec to drift apart. If a third consumer of ORTB appears that is neither prebid nor
GAM, moving the ORTB types to their own namespace is the cleanup — the field's name and shape do
not change with it.

### Merge and lifetime follow keyValues

The static half (`MoliConfig.targeting.ortb2`) is the base; the runtime half set via `setConfig()`
is merged on top of it with `mergeDeep` — objects merged recursively, arrays concatenated, scalars
overwritten by the later value. That is the same `mergeDeep` the prebid first-party-data module
already uses, so publishers get one merge rule across the ad tag rather than two.

The runtime half is reset on each single-page-app `requestAds()` and kept under `keepTargeting`,
exactly like `keyValues` and `labels`. Page content is page-scoped by definition: an in-app
navigation to another question must not leave the previous question's headline in the bid stream.

`getPageTargeting().ortb2` returns `{}` when neither half is set, matching how `keyValues` and
`adUnitPathVariables` always return an object.

### Prebid first-party data uses it as the merge base

The `prebid-first-party-data` module takes `targeting.ortb2` as the base of the ortb2 object it
hands prebid, below its own `staticPrebidFirstPartyData` and below what prebid already holds. The
module's own static config is the more specific statement of intent for a publisher who sets both,
so it wins; the IAB category mappings from key-values keep working exactly as before.

Only the **static** half reaches prebid in this step. Wiring the runtime half into prebid changes
what every bidder sees on every page and is a decision of its own, taken separately.

### The bridge serves it to creatives

`BridgeProtocol` gains an `h5.ortb2` message. A creative posts `{ event: 'h5.ortb2' }` to the top
window and the page replies to the asking window with `{ event: 'h5.ortb2.response', ortb2 }`.

Three properties of that handler are deliberate:

- **ortb2 only.** The reply never carries the whole targeting object. `gf_a` (audience segment ids)
  and `gf_scoreLevel` are page targeting a creative has no business reading, and the narrow reply
  is what keeps them unreachable. A creative that wants more has to have it put into `ortb2`
  explicitly.
- **Read live, through `window.moli.getPageTargeting()`.** The bridge's init step is memoised, so
  the `AdPipelineContext` the listener closes over is the one from the *first* ad request and never
  changes. A single-page-app navigation builds a fresh runtime config, so a listener reading the
  captured context would hand a creative the previous question's headline. Reading through the
  public accessor on the window is the only way to see the current page.
- **No origin check.** This matches `h5.adunit.passback` and `h5.adunit.refresh`, which have none
  either, and it is what keeps the message working for sandboxed SafeFrames whose origin is `null`.
  The reply goes to `event.source` only — it is never broadcast — so the data reaches the window
  that asked and no other. The accepted cost is that the page answers any iframe that asks,
  including third-party creatives in other slots; that is why the reply scope is narrow.

## Consequences

- Page content has one named home. A reviewer can see from the field name what is leaving the page.
- Whatever a publisher puts in `targeting.ortb2` goes to every prebid bidder. That is the point,
  and it is also the risk: `site.content.title` is a real content signal and it is now in every bid
  request. Withdrawing it is a config change, not a code change.
- `keyValues` keeps its meaning. `adManagerExcludes` is unchanged and still gates only the GAM path
  — this ADR is the reason not to reach for it as a privacy control.
- The bridge answers any iframe. Anything added to `ortb2` is readable by any creative on the page,
  so `ortb2` is not a place for anything that should not be.
- Only the static half reaches prebid today. The runtime half is readable through
  `getPageTargeting()` and over the bridge, but does not reach bidders until the follow-up story
  wires it — a deliberate gap, not an oversight.
