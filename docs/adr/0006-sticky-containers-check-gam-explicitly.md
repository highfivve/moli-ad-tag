# Sticky header/footer-v2 gate on `channel === 'gam'`, checked reactively

GD-10156 requires the sticky header and sticky footer-v2 containers to hide themselves
whenever GAM wins the anchor waterfall for their position, instead of racing GAM's own
out-of-page anchor render. Two decisions were made implementing this, both reversible only
at real cost since they're threaded through the same render-result plumbing every publisher
config already depends on:

**Checked reactively, not as a pre-render gate.** The channel is resolved once per
`prepareRequestAdsSteps__` cycle and folded into the existing `slotRenderEnded`-driven
render-result check, resolving to the existing `'disallowed'` value — the same path
`disallowedAdvertiserIds` already uses. An early gate (skip DOM/observer setup entirely
before the request even goes out) was considered and rejected: it would have duplicated the
existing gating chain instead of reusing it, for no behavioral difference given
`prepareRequestAdsSteps__` already re-runs per ad-request cycle.

**Gate condition is `channel === 'gam'`, not `channel !== 'c'`.** The ticket's literal
wording is the latter, but `anchorTopChannel()`/`anchorBottomChannel()` return `undefined`
for any publisher with no `AnchorConfig` at all — the overwhelming majority of existing
sticky-header/footer-v2 installs, since this wiring didn't exist before. `!== 'c'` would have
silently started hiding those containers. `=== 'gam'` matches every other call site in the
codebase (`googleAdManager.ts`, `prebid.ts`) and preserves current behavior for anyone not
using the GAM anchor waterfall feature.
