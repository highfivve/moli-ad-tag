# IntentIQ module owns the iiqAnalytics adapter too

Supersedes the "Analytics stays entirely in the config" half of
[ADR 0012](./0012-intentiq-module-owns-its-prebid-userid-config.md). The userId half of 0012 stands
unchanged.

0012 split IntentIQ along ownership lines: the `intentiq` module owns the `intentIqId` userId
provider, while the `iiqAnalytics` analytics adapter is authored in
`MoliConfig.prebid.analyticAdapters` by highfivve-portal like every other analytics adapter. That
split assumed the two integration points are independent. They are not.

IntentIQ's own integration example passes **one** `configObject` to both:

```js
pbjs.setConfig({ userSync: { userIds: [{ name: 'intentIqId', params: configObject, storage: {…} }] } });
pbjs.enableAnalytics({ provider: 'iiqAnalytics', options: configObject });
```

The analytics adapter reads back the A/B group and first-party data that the userId submodule
stored. A `partner`, `domainName`, `ABTestingConfigurationSource`, `abPercentage`,
`browserBlackList` or `region` that disagrees between the two does not fail loudly — it produces
reports attributed to the wrong cohort. The 0012 split made that divergence not just possible but
structural: the module derived `domainName`, `gamObjectReference` and `region` at runtime, from
values the portal could not see, so the portal-authored analytics options could never be more than
an approximation of them.

## Decision

The module owns both. It builds one `prebidjs.userSync.IIntentIqConfig` from
`modules.intentiq.IntentIqModuleConfig` plus the runtime values, passes that object to
`userSync.userIds[].params` via `pbjs.mergeConfig`, and passes *the same object reference* to
`pbjs.enableAnalytics({ provider: 'iiqAnalytics', options })`. Both happen in the one
`intentiq-configure` step. There is no separate analytics toggle: analytics is on whenever the
module is on, because analytics configured without the matching userId config reports nothing
useful.

Consequences in the type system:

- `prebidjs.userSync.IIntentIqIdProviderParams` and
  `prebidjs.analytics.IIntentIqAnalyticsAdapterOptions` are replaced by the single
  `prebidjs.userSync.IIntentIqConfig`, the union of both prebid parameter sets. Where they
  disagreed on `additionalParams` (`Record` in `intentIqIdSystem`, array in
  `intentIqAnalyticsAdapter`) the array shape wins: both modules hand the value to
  `handleAdditionalParams`, which ignores anything that is not an array.
- `MoliConfig.prebid.analyticAdapters` is typed `ConfigurableAnalyticsAdapter[]`, a union that
  deliberately excludes `IIntentIqAnalyticsAdapter`, so the adapter cannot be authored in the
  config at all. `prebidjs.analytics.AnalyticsAdapter` remains the wider union that
  `pbjs.enableAnalytics` accepts.

## Enabling it exactly once

`pbjs.enableAnalytics` has no "already enabled" check — a second call registers a second
`iiqAnalytics` instance and every auction gets reported twice. The configure step runs once per
requestAds cycle, which in an SPA means once per page view, so the module keeps a local
`analyticsEnabled` flag and enables on the first cycle only. This is deliberately *not* the same
guard as the userId merge, which re-checks `pbjs.getConfig().userSync` on every cycle: prebid's
`userSync` config can be replaced between cycles, an enabled analytics adapter cannot be unenabled.

This is the generalisation of 0012's closing note: a module owns one vendor's prebid config keys end
to end — all of them, when the vendor requires them to agree.

## Amendment (2026-10-29): IntentIQ Bidders and the Manual Win Report (GD-10631)

highfivve-portal can exclude bidders from IntentIQ (highfivve-portal ADR 0041). It derives the
remaining **IntentIQ Bidders** and emits them as `modules.intentiq.bidders`; moli never sees the
exclusion. A non-empty `bidders` is the only switch, and it changes all three integration points
together, because they must agree:

- the `intentIqId` userId entry gets `bidders`, so only those bidders receive the EID;
- the shared config object gets `manualWinReportEnabled: true`, so the `iiqAnalytics` adapter
  stops reporting every win itself;
- the module registers one prebid `bidWon` listener and reports wins of the IntentIQ Bidders via
  `window.intentIqAnalyticsAdapter_<partner>.reportExternalWin` (the **Manual Win Report**).

The listener is registered in the same once-per-page branch that enables the adapter, for the same
reason: a second registration on an SPA navigation would report every win twice.
`biddingPlatformId` is always `1` (prebid), for server-side bids too — they are still prebid wins.
When the adapter's window variable is missing (GDPR enforcement blocked the adapter, or the Prebid
Distribution does not ship it), the win is skipped with a debug log.
