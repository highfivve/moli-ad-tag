---
title: Out-of-page ads
---

Out-of-page ads are formats that don't live in the normal content flow - interstitials and
anchor (sticky) ads. GAM defines them via `defineOutOfPageSlot` instead of the regular
`defineSlot` used for `in-page` slots. moli supports GAM's raw formats directly, and also offers
**hybrid positions** that combine a raw GAM format with prebid demand through a waterfall.

## The waterfall concept

A hybrid position (`interstitial`, `anchor-bottom`, `anchor-top`) doesn't pick a single ad
source. It runs a **waterfall** between two channels:

- **`gam`** - the raw GAM out-of-page format (Web Interstitial / Anchor)
- **`c`** ("custom") - a regular in-page slot at the same `domId`, filled by prebid demand

Which channel is used for the *next* ad request is decided by a priority list (`priority:
['gam', 'c']` or `['c', 'gam']`), persisted in storage per `domId`. The winning channel is kept
as long as it keeps delivering; priority only shifts to the next channel once the current one
fails (empty GAM ad, or no prebid bid). This lets you e.g. prefer prebid demand but fall back to
GAM's native format when nobody bids, without re-auctioning both on every single page view. If
`priority` is empty, the position is not requested at all.

Interstitials shift on *every* attempt (success or fail) instead - a GAM-hardwired frequency cap
on the Web Interstitial format requires giving other channels a turn even after a successful
render. Anchor ads have no such cap, so they use the fail-only policy described above.

## Supported formats

### `out-of-page`

The generic GAM out-of-page format (e.g. a native ad that doesn't fit a standard size). No
waterfall - always requested through GAM.

```ts
const slot: Moli.AdSlot = {
  domId: 'content_native',
  adUnitPath: '/1234/content_native',
  sizes: [[1, 1]],
  position: 'out-of-page',
  behaviour: { loaded: 'eager' },
  sizeConfig: []
};
```

### `out-of-page-interstitial`

Raw [GAM Web Interstitial](https://support.google.com/admanager/answer/9840201). No prebid demand, no waterfall - use the `interstitial` position below
if you want prebid to compete.

```ts
const slot: Moli.AdSlot = {
  domId: 'interstitial_gam_only',
  adUnitPath: '/1234/interstitial',
  sizes: [[1, 1]],
  position: 'out-of-page-interstitial',
  behaviour: { loaded: 'eager' },
  sizeConfig: []
};
```

### `out-of-page-top-anchor` / `out-of-page-bottom-anchor`

Raw GAM anchor (sticky) ad, pinned to the top or bottom of the viewport by GAM itself.
Collapsibility is a GAM line-item/creative setting, not something configured here. No prebid
demand, no waterfall.

```ts
const slot: Moli.AdSlot = {
  domId: 'floorad',
  adUnitPath: '/1234/floorad',
  sizes: [[320, 50]],
  // swap for 'out-of-page-top-anchor' to pin to the top instead
  position: 'out-of-page-bottom-anchor',
  behaviour: { loaded: 'eager' },
  sizeConfig: []
};
```

See [Traffic anchor ads on web](https://support.google.com/admanager/answer/10452255) and [Collapsible anchor ads for web](https://support.google.com/admanager/answer/14882480) for more information.

### `interstitial`

Hybrid: waterfall between a custom (prebid) interstitial and the GAM Web Interstitial.
Configured via `globalAuctionContext.interstitial`.

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [
    {
      domId: 'interstitial_1',
      adUnitPath: '/1234/interstitial_1',
      sizes: [[1, 1]],
      position: 'interstitial',
      behaviour: { loaded: 'eager' },
      sizeConfig: []
    }
  ],
  globalAuctionContext: {
    interstitial: {
      enabled: true,
      adUnitPath: '/1234/interstitial_1',
      domId: 'interstitial_1',
      priority: ['c', 'gam']
    }
  }
};
```

See [Traffic web interstitials](https://support.google.com/admanager/answer/9840201) for more information.

### `anchor-bottom` / `anchor-top`

Hybrid: waterfall between a custom (prebid) sticky element and the GAM Anchor format.
Configured via `globalAuctionContext.anchorBottomMobile` / `anchorBottomDesktop` / `anchorTop` -
independent waterfall state per position. The two bottom configs are disambiguated by `domId`
(`mobile_stickyad` vs `floorad`), so both can run at once on a responsive page.

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [
    {
      domId: 'mobile_stickyad',
      adUnitPath: '/1234/mobile_stickyad',
      sizes: [[320, 50]],
      position: 'anchor-bottom',
      behaviour: { loaded: 'eager' },
      sizeConfig: []
    }
  ],
  globalAuctionContext: {
    anchorBottomMobile: {
      enabled: true,
      adUnitPath: '/1234/mobile_stickyad',
      domId: 'mobile_stickyad',
      priority: ['gam', 'c']
    }
  }
};
```

See [Traffic anchor ads on web](https://support.google.com/admanager/answer/10452255) and [Collapsible anchor ads for web](https://support.google.com/admanager/answer/14882480) for more information.


## Unsupported formats

- **Rewarded ads** (`OutOfPageFormat.REWARDED`) - not a slot position. Requested on demand via
  the [`rewardedAd()`](./rewarded-ad) API instead.
- **Left / right side rails** (`LEFT_SIDE_RAIL` / `RIGHT_SIDE_RAIL`) - not implemented.
- **Game manual interstitial** (`GAME_MANUAL_INTERSTITIAL`) - not implemented.
