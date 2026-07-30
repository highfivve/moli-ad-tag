# Emetriq app path takes `link`, `keywords` and `device_id` at runtime; static config only selects the variant

GD-8993 migrates the hand-written `gutefrage-loggedin` ad tag onto the generated remote
MoliConfig. The manual tag built its emetriq config in JavaScript, branching on a `clientType`
(`web`/`pwa`/`android`/`ios`) that NMMS injected via the `<script>`'s `data-ad-tag-config` — the
app branch produced an in-app tracking pixel keyed on the device's advertising id, the app-store
`appId`, and the current page URL. A generated MoliConfig is instead a static JSON snapshot served
from the CDN, so none of those runtime-only values can live in it, and there is no code in which to
branch on `clientType`.

Two questions had to be settled, both touching the **published** emetriq module config (npm +
`schema.json`), which makes them expensive to reverse.

## Selection stays label-`Overridable`; no new selection mechanism

Which emetriq variant runs (`web` default vs `ios`/`android` app) is decided by the existing
label-conditioned `Overridable<EmetriqModuleConfig>` (ADR 0001): the inline config is the `web`
default, and `ios`/`android` are overrides selected by a `labelAll` on the respective [Client Type]
label. The module's `configure__`/`initSteps__`/`configureSteps__` are unchanged — they already
branch on the resolved `config.os`. Per-OS `appId` needs no special modelling because each override
entry carries a full `EmetriqAppConfig` with its own `appId`.

We rejected two alternatives:

- **A bespoke `configs: [{condition, config}]` array on emetriq.** Functionally close to
  `Overridable`, but a `LabelCondition` is always a non-empty `labelAll`/`labelAny`/`labelNone` —
  there is no "always true" condition — so a flat, all-entries-gated list cannot express a
  guaranteed fallback. `Overridable`'s inline default *is* that fallback (`web`), matching the
  manual tag's `default:` branch that deliberately returned the web config for unknown/missing
  `clientType` ("prevents entire outage"). It would also have introduced a second override idiom
  alongside the ~20 modules already using `Overridable`.

- **Adex-style selection on a `clientTypeKey` key-value.** The sibling DMP module
  (`ads/modules/adex`) decides app-vs-web by reading `gamKeyValues[clientTypeKey]`. Reusing that
  here would avoid labels entirely, but it forces a single app config to serve both OSes and
  therefore an `appId`-by-OS map, plus a larger module/config rewrite — whereas `Overridable` needs
  no selection-logic change and keeps one complete config per OS.

## `link`, `keywords` and `device_id` are sourced at runtime inside `trackInApp`

None of these can be baked into a static per-publisher config, so the app pixel resolves them at
request time:

- **`link` is always `context.window__.location.href`.** The `linkOrKeyword` config field and the
  `EmetriqAppKeywordOrLinkConfig` type are **removed**. The manual tag sent `window.location.href`;
  a static config cannot carry the current URL (every page, and every SPA navigation, differs), so
  the module reads it directly rather than accepting it as config.

- **`keywords` is an optional `keywordsKey` looked up from the merged targeting.** Mirrors how
  `advertiserIdKey` already works and how Adex reads its key-values:
  `keywords = { ...config__.targeting.keyValues, ...runtimeConfig__.keyValues }[keywordsKey]`,
  omitted when the key is unset or absent.

- **`device_id` is read from the *merged* targeting, not static config alone.**
  `extractDeviceIdParam` previously read only `config__.targeting.keyValues[advertiserIdKey]`, so an
  `advertising_id` supplied at runtime via `setTargeting` — the only way an app webview can provide a
  per-device IDFA/ADID — was silently dropped and the pixel went out with no `device_id`. It now
  reads the same merged map the module's own `initSteps__` already uses. This is a bug fix the
  migration depends on.

## Consequences

- **Breaking change to the published emetriq config**: `EmetriqAppConfig` loses `linkOrKeyword`,
  gains optional `keywordsKey`; `EmetriqAppKeywordOrLinkConfig` is deleted. Regenerate `schema.json`.
- The app path now has a hard **integration contract** on the embedding page (NMMS): before
  `requestAds`, add the `ios`/`android` [Client Type] label, `setTargeting('advertising_id', <idfa>)`,
  and (if used) set the keywords key-value. This lives outside this repo.
- `link` is no longer configurable — a publisher who genuinely needs a fixed link rather than the
  page URL is unsupported (none does today).
- The generated JSON and per-OS `appId` are produced by highfivve-portal; see that repo's ADR on the
  emetriq write-model and auto-derived client-type overrides.
