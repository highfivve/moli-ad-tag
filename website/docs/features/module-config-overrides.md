---
title: Module Config Overrides
---

Module config overrides let a module run with a **different configuration** depending on the active
[labels](./labels.md). Each module gets a default configuration plus an ordered list of overrides,
each guarded by a label condition. At the first ad request the active labels select the first
matching override, whose configuration fully replaces the default.

This builds on two existing label concepts:

- [Labels](./labels.md) provide the identifiers (`addLabel()`, the `data-labels` script attribute,
  size config, device/geo detection) that drive every condition.
- The module **activation gate** (`labelCondition` on a module config) turns a module on or off.

An override changes _which_ configuration an active module runs with, while the activation gate only
turns it on or off. The two are orthogonal and can be combined.

## Use cases

The same module often needs to behave differently depending on the page it is delivered to.
Conditional module configurations let you tailor the user experience, analytics tracking and revenue
behaviour to the audience without shipping a separate ad tag per variant. Common dimensions:

- **Logged-in vs. logged-out user**: run a leaner ad reload interval for logged-in readers, or send
  a different analytics tag for each audience.
- **Premium vs. basic subscription**: disable a module entirely for premium subscribers, enable
  brand-safety scanning only for basic users.
- **Article vs. video page**: reload behaviour, lazy loading and yield optimization that fit text
  pages rarely fit video pages.
- **Organic vs. direct traffic**: attribute analytics differently, or change which integrations load
  based on traffic source.

In each case a single module entry carries the default plus the per-audience overrides, selected by
the labels you set before requesting ads.

## Selection algorithm

For each registered module, resolution runs once when the page is configured:

1. Read the module's configuration `base = config.modules[name]`. If absent, skip the module.
2. If `base.overrides` is set, evaluate each entry's label condition in order. The **first match
   wins**: its `config` becomes the effective configuration, **fully replacing** the default. If no
   entry matches, the default `base` is used.
3. Apply the activation gate: if the effective config has a `labelCondition` that is not met, the
   module is skipped entirely.
4. The module is configured with the effective config. The `overrides` field is stripped, so modules
   never see it.

```text
base = config.modules[name]
if (!base) skip
effective = base
if (base.overrides matches an entry) effective = entry.config   // first match, full replace
if (effective.labelCondition not met) skip
configure(effective)
```

### Full replace, not merge

A matching override replaces the default completely. Fields present only in the default are **not**
carried over, so list every field the override needs. This avoids merge ambiguity (array
concat-vs-replace, nested objects, `undefined` meaning).

### One-time at configure

Resolution happens once, at the first ad request. [Single page app](./single-page-app.md)
navigations do not re-resolve overrides, so the module configuration is fixed for the page lifetime.
Set the labels that drive selection before the first `requestAds()` (via `addLabel()` or
`data-labels`).

### Disabling a module per label

Because the override fully replaces the default, an override `config` with `enabled: false` disables
the module for its labels.

### Override condition vs. activation gate

The condition on an override entry (`labelAll` / `labelAny` / `labelNone`) is the **selector** that
picks which config. A `labelCondition` _inside_ a resolved config is the **gate** that turns the
module on/off. Setting `labelCondition` inside an override config is normally pointless; leave it
unset.

## Examples

### Different config per content type

Pubstack runs with a different `tagId` on article pages and is disabled where a `no-analytics`
label is present. Each override config must be complete, so `tagId` is repeated because the match
fully replaces the default:

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [ /* ... */ ],
  modules: {
    // highlight-start
    pubstack: {
      enabled: true,
      tagId: 'default-tag',
      overrides: [
        {
          labelAll: ['article'],
          config: { enabled: true, tagId: 'article-tag' }
        },
        {
          labelAny: ['no-analytics'],
          config: { enabled: false, tagId: 'default-tag' }
        }
      ]
    }
    // highlight-end
  }
};
```

```ts
// drives the selection, must run before the first requestAds()
window.moli.addLabel('article');
window.moli.requestAds();
```

### First match wins

When several conditions match, the earlier entry in the array wins. With both `video` and `article`
active, the `video` override is selected:

```ts
modules: {
  pubstack: {
    enabled: true,
    tagId: 'default-tag',
    overrides: [
      { labelAny: ['video'], config: { enabled: true, tagId: 'video-tag' } },
      { labelAll: ['article'], config: { enabled: true, tagId: 'article-tag' } }
    ]
  }
}
```

Order the overrides from most specific to least specific so the intended entry matches first.

### Enable a module only for a segment

Confiant runs only for users carrying the `premium` label. Everyone else gets the disabled default:

```ts
modules: {
  // highlight-start
  confiant: {
    enabled: false,
    overrides: [
      {
        labelAll: ['premium'],
        config: {
          enabled: true,
          assetUrl: 'https://test.confiant.com/guard.js'
        }
      }
    ]
  }
  // highlight-end
}
```

## Supported modules

Every entry in `modules` supports `overrides`. See the [modules reference](../modules/) for
the configuration of each module.
