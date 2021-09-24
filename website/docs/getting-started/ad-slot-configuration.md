---
title: Ad Slots
---

An _ad slot_ is the most basic building block of your ad tag. It maps to a `div` element on the publisher page and
to an [_ad unit_ in Google Ad Manager](https://support.google.com/admanager/topic/10478086). [A full API reference can be found here](../api/interfaces/Moli.AdSlot.md).

The ad slot configuration contains

- `domId` to identify the ad slot on the page
- `adUnitPath` to map the ad slot to a Google Ad Manager ad unit
- `sizes` and `sizeConfig` to configure the sizes that should be requested
- `position` for ad slot kind
- `behaviour` to specify when the ad slot should be loaded
- `gpt` for additional Google Ad Manager specific configuration
- `prebid` for the [prebid ad unit configuration](https://docs.prebid.org/dev-docs/adunit-reference.html)
- `a9` for Amazon TAM configuration
- `labelAll` / `labelAny` for ad slot filtering


## Minimal ad slot configuration

This is a minimal ad slot configuration.

```ts
import { Moli } from '@highfivve/ad-tag';

const slot: Moli.AdSlot = {
  // A div element with this ID must be present on the publisher page
  domId: 'content_1',

  // the full ad unit path in google ad manager
  adUnitPath: '/1234/content_1',

  // what sizes should be requested
  sizes: [ [300, 250] ],

  // where the ad slot should positioned. Everything else than 'in-page' is some sort
  // of special format, like interstitials or sticky ads provided by Google Ad Manager
  position: 'in-page',

  // when the ad slot should be loaded. `eager` means as soon as the ad tag has loaded
  behaviour: {
    loaded: 'eager'
  },

  // configure different sizes depending on mediaQueries or labels.
  // If empty, all sizes will be requested
  sizeConfig: []
};
```

On your page you must have a div `<div id="content_1></div>` present when the dom is ready.

## Loading behaviour

The timing when an ad slot is loaded is crucial for site performance, viewability and revenue. You can choose from
the following loading strategies:

* `eager` - slot is loaded as soon as the ad tag is ready
* `lazy` - slot is loaded when an event is fired
* `manual` - slot is loaded via ad tag API
* `refreshable` - slot can be `lazy` or `eager` with the same configuration options

### Eager

This should be the default for all above the fold ad slots. The ad tag starts loading these slots as soon as possible.

#### Usage

```js
behaviour: {
  // highlight-next-line
  loaded: 'eager'
}
```

### Manual

The page loads these ad slots via [the `refreshAdSlot('<dom id>')` API](../api/interfaces/Moli.MoliTag.md#refreshadslot).

:::tip Prefer manual over lazy and refreshable

The `manual` loading behaviour works in any order and batches ad server calls if possible.

:::

#### Usage

```js
domId: 'content_1',
behaviour: {
  // highlight-next-line
  loaded: 'manual'
}
```


On your page

```js
window.moli = window.moli || { que: [] };
window.moli.que.push((moliAdTag) => {
  // highlight-next-line
  moliAdTag.refreshAdSlot('content_1');
});
```

Slots loaded manually come with the following properties

* `refreshAdSlot` can be called at any time
* `refreshAdSlot` calls are batched until `requestAds` is called. This avoids unnecessary ad server calls

:::danger Test your refresh logic!

Refreshing an ad slot too often or too fast is seen as ad fraud and will be punished by exchanges!

:::

### Lazy

An event triggers the ad slot refresh. Use this if there are already dom events available that should trigger and ad
refresh.

#### Usage

The [`EventTrigger`](../api/interfaces/Moli.behaviour.EventTrigger.md) configures when the ad slot should be loaded.

```js
behaviour: {
  loaded: 'lazy',
  trigger: {
    name: 'event',
    event: 'ad.content_1',
    source: window
  }
}
```

On your page

```js
window.moli = window.moli || { que: [] };
window.moli.que.push((moliAdTag) => {
  // all event listeners are now in place
  moliAdTag.afterRequestAds(() => {
    // sent event `ad.content_1` on `window` to trigger ad refresh
    window.dispatchEvent(new Event('ad.content_1'));
  });
});

```

### Refreshable

An ad slot that can be refreshed with the same event multiple times. Use `manual` ad slot if possible.

The common use case for this is to reload slots when the user interacts with the page and the layout changes, e.g.
sorting a list of items.

#### Usage

If `lazy` is true the ad slot will load on the first event. This is the same behaviour as the `lazy` loading behaviour.

```js
behaviour: {
  loaded: 'refreshable',
  // highlight-next-line
  lazy: true,
  trigger: {
    name: 'event',
    event: 'ad.content_1',
    source: window
  }
}
```

If `lazy` is false the ad slot will load as soon as possible. This is the same behaviour as the `eager` loading behaviour.

```js
behaviour: {
  loaded: 'refreshable',
  // highlight-next-line
  lazy: false,
  trigger: {
    name: 'event',
    event: 'ad.content_1',
    source: window
  }
}
```

## Size Config

The `sizeConfig` property configures _what_ sizes the ad tag requests It is an array of [SizeConfig entries](../api/interfaces/Moli.SizeConfigEntry.md).
The spec is almost identical to the [prebid sizeConfig](https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#sizeConfig-How-it-Works).

This is what a simple configuration might look like

```js
sizeConfig: [{
  // mobile devices support 300 width at max
  mediaQuery: '(max-width: 767px)',
  sizesSupported: [[300,50]]
}, {
  // desktop supports 728px width
  mediaQuery: '(min-width: 768px)',
  sizesSupported: [[728,90]]
}]
```

See [the responsive ads section](../features/size-config.md) for an in detail explanation of the size config.

## Labels

Each ad slot may specific either a `labelAll` or `labelAny` array. An ad slot is only requested if the label
conditions are met. The ad tag follows the [prebid.js label spec](https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#labels).

- See [the labels section](../features/labels.md) for an in detail explanation of `labelAll` and `labelAny`
- See [conditional ad slots](../guides/conditional-ad-slots.md) for a specific label use case

## Best practices

* Keep your ad slot number low
* Try to generate 1-1 mappings between ad slots and Google Ad Manager ad units. This makes optimizations and debugging easier
* Reuse ad slots only for infinite loading streams
* Think responsive - an ad slot may have different sizes on different devices, but it's still the same position
* Use `manual` loading behaviour over `lazy` and `refreshable` as events can only be sent if event listeners are already in place
