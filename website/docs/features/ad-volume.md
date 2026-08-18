---
title: Ad Volume
---

Ad Volume is a publisher/page-level ad density setting, in the range `1`-`10`. It is purely a
targeting signal — moli does not interpret the value itself. It is emitted as cumulative
`av1..avN` labels for ad ops to build GAM line-item rules against. It has no relationship to
consent, ad-blocking, or any ad-free state.

## Overview

Ad Volume lets you tell the ad server how "dense" an ad load a given pageview should get,
without moli itself deciding what that density means. A setting of `4` emits the labels
`av1`, `av2`, `av3`, `av4` — ad ops then targets GAM line items against those labels (e.g. an
"ultra-light" line item targets `av1`, a denser one targets `av1` through `av4`).

There are two ways to set it:

- **Static** — `Targeting.adVolume` in `MoliConfig`, fixed for the whole ad tag deployment.
- **Runtime override** — `setConfig({ adVolume })` or the `data-ad-volume` script attribute,
  set per pageview.

## Static configuration

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [ /* ... */ ],
  // highlight-start
  targeting: {
    adVolume: 5
  }
  // highlight-end
};
```

If not set, no `av*` labels are emitted and no default is assumed.

## Runtime override

### Via setConfig()

```ts
window.moli.que.push(function (moli) {
  moli.setConfig({ adVolume: 4 });
});
```

When set, this takes precedence over `Targeting.adVolume` from the static config for that
pageview. See the [setConfig() API reference](./set-config.md) for the full API.

### Via script attribute

If you use the `configureFromEndpoint` bundle, add `data-ad-volume` to the script tag — no
publisher JS required. This is equivalent to calling `moli.setConfig({ adVolume })` yourself.

```html
<script id="moli-ad-tag" src="path/to/your/ad-tag-bundle.js"
       data-ad-volume="4"
></script>
```

## Validation

`adVolume` must be an integer between `1` and `10` (no `0`). Invalid values (`NaN`, out of
range, non-integer) are logged as a warning and ignored — the previous value, if any, is kept.
This applies to both the static config and the runtime override.

## How it becomes labels

`adVolume` is converted into cumulative `av1..avN` labels before each ad request:

```ts
// adVolume: 4  ->  ['av1', 'av2', 'av3', 'av4']
```

These are ordinary [labels](./labels.md) — they can be used in `labelAll`/`labelAny`/`labelNone`
conditions on ad slots, prebid bids, and size configs, in addition to being handed to GAM as
targeting for line-item rules.

## Precedence

Runtime `setConfig({ adVolume })` overrides `Targeting.adVolume` from the static config for the
current pageview. There is no merging between the two — whichever value is active when
`requestAds()` runs is the one that gets converted into `av*` labels.

## Common pitfalls

### Confusing with gutefrage's per-user Ad Volume

This is a page-level config with no user identity. It is unrelated to gutefrage's
identically-named, identically-labeled per-user concept, which is an admin-set, login-based
control that also overrides an ad-free calculation.

### Expecting moli to interpret the value

moli never changes its own behaviour based on `adVolume` — no slot is hidden or shown, no
prebid bidder is enabled or disabled by moli itself. It is purely a signal for ad ops to build
GAM line-item targeting against the `av*` labels.

## API Reference

### Available Methods

- `setConfig({ adVolume })` - override the ad volume for the current pageview

For detailed API documentation, see the [setConfig() API reference](./set-config.md) and the
[MoliTag API reference](/api/types/moliRuntime/namespaces/MoliRuntime/interfaces/MoliTag).

### Example Usage

```ts
// Static config
const moliConfig: Moli.MoliConfig = {
  targeting: { adVolume: 5 }
};

// Runtime override
window.moli.que.push(function (moli) {
  moli.setConfig({ adVolume: 4 });
});
```
