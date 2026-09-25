# IntentIQ is a module that owns its prebid userId config

> **Partly superseded by [ADR 0013](./0013-intentiq-module-owns-the-iiqanalytics-adapter-too.md).**
> The "Analytics stays entirely in the config" decision below no longer holds: the module owns the
> `iiqAnalytics` adapter as well, because IntentIQ requires both integration points to share one
> config object. Everything else here — the userId provider as a module, and why `mergeConfig` is
> safe — still stands.

IntentIQ has two prebid integration points: the `intentIqId` userId submodule and the
`iiqAnalytics` analytics adapter. The first implementation (GD-10371, since reverted) wired both
into `ads/prebid.ts`: publishers were expected to author an `intentIqId` entry in
`MoliConfig.prebid.config.userSync.userIds`, `prebidConfigure` enriched it with runtime values
(`domainName`, `gamObjectReference`, `region`), derived the `iiqAnalytics` adapter options from
that enriched entry, and called `pbjs.enableAnalytics` itself.

That made the core prebid code IntentIQ-aware for a single vendor, and it put the ad-tag in the
business of generating an analytics adapter configuration that `MoliConfig` can already express.
We replaced it with a split along ownership lines:

**Analytics stays entirely in the config.** `iiqAnalytics` is authored in
`MoliConfig.prebid.analyticAdapters` by highfivve-portal, like every other analytics adapter, and
enabled by the existing generic `pbjs.enableAnalytics(analyticAdapters)` call in `prebidInit`.
There is no IntentIQ-specific analytics code in the ad-tag. The
`IIntentIqAnalyticsAdapter`/`IIntentIqAnalyticsAdapterOptions` types remain in `types/prebidjs.ts`
so the portal has something to type its config against.

**The userId provider becomes a module.** `ads/modules/intentiq` (configKey `intentiq`) takes its
own `modules.intentiq.IntentIqModuleConfig`, builds the complete `intentIqId` provider entry, and
merges it into prebid in a `mkConfigureStepOncePerRequestAdsCycle` with `pbjs.mergeConfig`. Fields
that only exist at runtime — `domainName` (from `adUnitPathVariables.domain`),
`gamObjectReference` (`window.googletag`, only when `gamParameterName` is set) and `region`
(always `'gdpr'`) — are computed in the module and are deliberately not configurable, so an
invalid combination cannot be expressed in the config at all. An init step loads IntentIQ's
optional raw-CDN-tag script (`scriptUrl`), gated on TCF vendor consent for GVL id 1323 only:
there is no documented purpose requirement to enforce, and prebid's own userId GDPR enforcement
governs the submodule itself.

## Why `mergeConfig` is safe here

`pbjs.setConfig` replaces `userSync` wholesale, and — unlike `setBidderConfig` — it has no merge
flag, so a module cannot use it without clobbering the `userSync` config that `prebidConfigure`
has already applied. `pbjs.mergeConfig` is the actual merge API. Its array semantics are "append
unless an deep-equal element already exists", which would silently duplicate a nearly-identical
entry. That is acceptable *only* because this module is the single writer of the `intentIqId`
entry: `MoliConfig` never authors one. The configure step additionally reads
`pbjs.getConfig().userSync` and skips the merge when an `intentIqId` provider is already present,
so repeated runs (SPA, or a publisher-authored entry appearing later) cannot produce two entries.

This is the pattern to follow for future vendor userId providers that need runtime-derived values:
a module that owns one prebid config key end to end, rather than vendor-specific branches in
`prebid.ts` plus a config the portal has to keep consistent with them.

## Amendment (2026-09-25): `mergeConfig` alone is not enough for initialization

The section above covers config *merging*, but not *timing*. `prebidConfigure` calls
`pbjs.setConfig` with the core `userSync.userIds` and this module calls `pbjs.mergeConfig` in a
separate `pbjs.que` command; prebid runs those commands individually, not atomically. Prebid's
userId module starts initializing as soon as `setConfig` delivers `userIds`, and it only does so
once. When consent is already resolved, that init can run in the gap before the merge, and
`intentIqId` is then registered but never initialized for the page view (no ID in the first
auctions of a session; observed on live traffic).

The configure step therefore calls `pbjs.refreshUserIds({ submoduleNames: ['intentIqId'] })` right
after the merge. If userId init hasn't run yet the refresh is a no-op and normal init picks up
`intentIqId`; if it has, the refresh initializes just `intentIqId`, and `auctionDelay` still waits
for it. The promise is not awaited; a rejection is only logged.
