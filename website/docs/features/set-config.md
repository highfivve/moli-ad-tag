---
title: setConfig() API Reference
---

`setConfig()` is the generic runtime-override API on `MoliTag`. It merges a partial object onto
the internal runtime config, one field at a time, each field using its own merge semantics. It
replaces the older one-method-per-field setters (`setTargeting`, `addLabel`, `setAudience`,
`setAdUnitPathVariables`), which are now deprecated wrappers around it.

## Signature

```ts
setConfig(partial: MoliRuntime.MoliRuntimeConfigOverrides): void;
```

Call it any time before `requestAds()` — before or after `configure()`. Multiple calls compose;
there is no priority system beyond ordinary call order.

```ts
window.moli.que.push(function (moli) {
  moli.setConfig({ adVolume: 7, labels: ['foo'], targeting: { key: 'value' } });
});
```

## Supported fields

| Field                | Type                  | Merge semantics                                             | Validated |
| -------------------- | --------------------- | ------------------------------------------------------------- | --------- |
| `adVolume`            | `number`               | Full replace                                                    | Yes — integer, `1`-`10` |
| `labels`              | `string[]`             | Append onto existing `runtimeConfig.labels`                    | No |
| `targeting`           | `KeyValueMap`          | Merged per-key into `runtimeConfig.keyValues` (`Object.assign`) | No |
| `ortb2`               | `PrebidFirstPartyData` | Deep merged into `runtimeConfig.ortb2`, arrays concatenated     | No |
| `audience`            | `AudienceTargeting`    | Full replace                                                    | No |
| `adUnitPathVariables` | `AdUnitPathVariables`  | Full replace                                                    | No |

Fields left `undefined` in the `partial` object are untouched — `setConfig({ adVolume: 5 })`
does not clear `labels`, `targeting`, or any other field.

## Examples

### Ad volume

```ts
window.moli.que.push(function (moli) {
  moli.setConfig({ adVolume: 4 });
});
```

Must be an integer `1`-`10`. Anything else (`0`, `11`, `4.5`, `NaN`) is dropped and logged as a
warning — the previously set value, if any, is kept. See [Ad Volume](./ad-volume.md).

### Labels

```ts
window.moli.que.push(function (moli) {
  moli.setConfig({ labels: ['mobile', 'premium-user'] });
});
```

Appends to the existing label list — same additive behaviour as the deprecated `addLabel()`.
Call again to add more; labels are never removed by `setConfig()`.

### Targeting

```ts
window.moli.que.push(function (moli) {
  moli.setConfig({ targeting: { category: 'sports', position: 'sidebar' } });
});
```

Merges per key into `keyValues`. Existing keys not present in the object are left untouched;
keys that are present overwrite the previous value for that key — same as the deprecated
`setTargeting(key, value)`, but for several keys in one call.

### ortb2

```ts
window.moli.que.push(function (moli) {
  moli.setConfig({
    ortb2: {
      site: {
        content: {
          title: 'How do I bake sourdough bread?',
          producer: { name: 'baker42' }
        }
      }
    }
  });
});
```

OpenRTB 2.6 first party data describing the current page and its content. This is where page
*content* belongs — the article headline, the author, the content language — as opposed to
`targeting`, which carries short GAM-shaped key-values.

Deep merged into `runtimeConfig.ortb2`: nested objects are merged recursively, arrays are
concatenated and scalars are overwritten by the later call. A branch not mentioned in the object
is left untouched, so several calls compose.

The runtime half is merged on top of the static `targeting.ortb2` from the ad tag configuration,
with the runtime half winning on scalars. Read the result back with `getPageTargeting().ortb2`.

```ts
// config:  targeting: { ortb2: { site: { cat: ['IAB1'], content: { language: 'de' } } } }
moli.setConfig({ ortb2: { site: { cat: ['IAB12'], content: { title: 'Headline' } } } });

moli.getPageTargeting().ortb2;
// { site: { cat: ['IAB1', 'IAB12'], content: { language: 'de', title: 'Headline' } } }
```

In a [single page application](./single-page-app.md) the runtime half is reset on each
`requestAds()` call, exactly like `labels` and `targeting` — page content is only valid for the
page it was set on. Set it again after every in-app navigation.

See [First Party Data](./first-party-data.md) for how `targeting.ortb2` reaches the prebid
bidders, and [Passback & Bridge](./passback.md) for how a creative reads it back over the bridge.

### Audience

```ts
window.moli.que.push(function (moli) {
  moli.setConfig({
    audience: { age: 32, gender: 'f' }
  });
});
```

Full replace — a later call with `audience` overwrites the entire object, not just the keys
present in it.

### Ad unit path variables

```ts
window.moli.que.push(function (moli) {
  moli.setConfig({ adUnitPathVariables: { device: 'mobile' } });
});
```

Full replace — same semantics as the deprecated `setAdUnitPathVariables()`.

### Several fields in one call

```ts
window.moli.que.push(function (moli) {
  moli.setConfig({
    adVolume: 7,
    labels: ['foo'],
    targeting: { key: 'value' }
  });
});
```

## Error handling

`setConfig()` never throws. Invalid fields are dropped and logged as a warning individually —
one bad field never blocks the rest of the overlay from applying. Today only `adVolume` has
validation (integer, `1`-`10`); the other fields are passed through as-is.

## Migrating from the deprecated setters

| Deprecated                              | Use instead                                          |
| ---------------------------------------- | ----------------------------------------------------- |
| `setTargeting(key, value)`               | `setConfig({ targeting: { [key]: value } })`          |
| `addLabel(label)`                        | `setConfig({ labels: [label] })`                      |
| `setAudience(audience)`                  | `setConfig({ audience })`                             |
| `setAdUnitPathVariables(variables)`      | `setConfig({ adUnitPathVariables: variables })`       |

The deprecated methods still work — they are now thin wrappers around `setConfig()` — but new
code should call `setConfig()` directly.

## Related

- [Ad Volume](./ad-volume.md)
- [Labels](./labels.md)
- [Targeting](./targeting.md)
- [First Party Data](./first-party-data.md)
- [Ad Unit Path Variables](./ad-unit-path-variables.md)
- ADR 0011 — Generic `setConfig()` API for runtime overrides
- [MoliTag API reference](/api/types/moliRuntime/namespaces/MoliRuntime/interfaces/MoliTag)
