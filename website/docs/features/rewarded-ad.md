---
title: Rewarded Ads
---

Rewarded ads let a publisher grant a user some benefit — unlocking an article, extra content,
an in-game item — in exchange for watching a full-screen ad to completion. Unlike regular ad
slots, a rewarded ad is not defined in `slots` and is not requested automatically by the ad
pipeline. It is explicitly requested at runtime via `moli.rewardedAd()`, typically from a button
click.

## Overview

`rewardedAd()` runs a **waterfall**: within a single call, moli attempts each configured
**channel** in priority order, falling through to the next channel immediately if the current
one has no fill. The call resolves once a channel grants the reward, the user cancels, or every
channel is exhausted.

Two channels are supported:

- **`gam`** — Google Ad Manager Rewarded Ads for Web
- **`welect`** — [Welect](https://www.welect.de/) Ad Chooser

Every business outcome — including a complete no-fill — **resolves** the promise. It only
**rejects** on unexpected technical exceptions, e.g. a crash in an underlying channel
integration.

## Usage

```javascript
document.getElementById('unlock-article').addEventListener('click', () => {
  window.moli.que.push(function (moliAdTag) {
    moliAdTag.rewardedAd().then(result => {
      switch (result.state) {
        case 'granted':
          // result.payload: { amount: number; type: string }
          unlockArticle(result.payload);
          break;
        case 'canceled':
          // the user closed the ad before finishing it
          break;
        case 'empty':
          // no channel could fill the request, or the feature isn't configured
          break;
        case 'error':
          // result.reason: 'already-in-progress' | 'ad-tag-error'
          break;
      }
    });
  });
});
```

### Result states

| `state`    | Meaning                                                                                                |
| ---------- |--------------------------------------------------------------------------------------------------------|
| `granted`  | The user completed the ad. `channel` and `payload` describe which channel filled and what was granted. |
| `canceled` | The user closed the ad before a reward was granted. `channel` names the channel that was showing.      |
| `empty`    | No channel filled the request, or `rewardedAd` is not configured / disabled.                           |
| `error`    | The call could not be performed. See reasons below.                                                    |

`error.reason`:

- `already-in-progress` — another `rewardedAd()` call is still in flight. Only one rewarded ad
  can run at a time; calling it again while one is active resolves immediately with this error
  instead of queueing.
- `ad-tag-error` — the ad tag is in the `error` state, so no rewarded ad can be requested.

### Timing: calls queue until `finished`

`rewardedAd()` is gated on the same pipeline state as `refreshAdSlot()`. Calls made in
`configurable`, `configured`, `requestAds`, or `spa-requestAds` are **queued** and resolve once
the pipeline reaches `finished` / `spa-finished`. This guarantees consent (CMP) has been
resolved before any rewarded ad script is loaded — a rewarded flow never fires ahead of the main
ad pipeline's `init`/`configure` stages. Calling `rewardedAd()` while in the `error` state
resolves immediately with `{ state: 'error', reason: 'ad-tag-error' }`.

In practice this means it's safe to wire up the button click handler immediately on page load —
the first click, even before `requestAds()` has completed, is queued rather than dropped or
rejected.

## Configuration

`rewardedAd` is configured under `globalAuctionContext.rewardedAd`:

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [ /* ... */ ],
  // highlight-start
  globalAuctionContext: {
    rewardedAd: {
      enabled: true,
      priority: ['gam', 'welect'],
      timeoutMs: 5000,
      gam: {
        adUnitPath: '/1234/publisher/rewarded'
      },
      welect: {
        bundleUrl: 'https://static.welect.de/p/bundles/example.js',
        payload: { amount: 1, type: 'article' }
      }
    }
  }
  // highlight-end
};
```

### Options

- **`enabled`** (`boolean`) — turns the feature on. If disabled, `priority` is empty, or a
  prioritized channel is missing its config block, `rewardedAd()` resolves with
  `{ state: 'empty' }`.
- **`priority`** (`RewardedAdChannel[]`) — the channels to attempt, in order. `['gam', 'welect']`
  tries GAM first, then Welect on no-fill; `['welect', 'gam']` reverses that.
- **`timeoutMs`** (`number`) — **per-channel** attempt budget, not a total budget for the whole
  waterfall. For `gam`, this is how long to wait for the `rewardedSlotReady` event before the
  slot is destroyed and the attempt counted as no-fill. For `welect`, this covers the SDK
  bundle download plus the `checkAvailability` call.
- **`gam`** (optional) — required if `priority` includes `'gam'`.
  - `adUnitPath` — the ad unit path for the rewarded slot. May contain
    [ad unit path variables](./ad-unit-path-variables).
- **`welect`** (optional) — required if `priority` includes `'welect'`.
  - `bundleUrl` — the partner-specific Welect SDK bundle URL, e.g.
    `https://static.welect.de/p/bundles/<a-bundle-id>.js`.
  - `payload` — the static reward payload (`{ amount, type }`) granted on a successful Welect
    session. Welect has no dynamic payload, so this value is used for every `granted` result on
    this channel.
  - `checkToken` (`boolean`, default `true`) — see [Welect token preflight](#welect-token-preflight)
    below.

Like other `globalAuctionContext` settings, `rewardedAd` supports the
[module config override](./module-config-overrides) pattern via `Overridable<RewardedAdConfig>`.

## Waterfall example

```ts
globalAuctionContext: {
  rewardedAd: {
    enabled: true,

    priority: ['welect', 'gam'],
    timeoutMs: 4000,
    welect: {
      bundleUrl: 'https://static.welect.de/p/bundles/example.js',
      payload: { amount: 1, type: 'article' },
      checkToken: true
    },
    gam: {
      adUnitPath: '/1234/publisher/rewarded'
    }
  }
}
```

With this config, a `rewardedAd()` call:

1. Checks for a valid Welect token — if present, grants immediately with the Welect payload.
2. Otherwise attempts Welect. On no-fill, falls through to GAM.
3. Attempts GAM. On no-fill, resolves with `{ state: 'empty' }`.

Only one call can be in flight at a time; a second `rewardedAd()` call made while the first is
still resolving immediately gets `{ state: 'error', reason: 'already-in-progress' }`.

## API Reference

See the [`MoliTag.rewardedAd()`](/api/types/moliRuntime/namespaces/MoliRuntime/interfaces/MoliTag)
API reference for the full method signature, and
[`RewardedAdConfig`](/api/types/moliConfig/namespaces/auction/interfaces/RewardedAdConfig) for
the configuration type.
