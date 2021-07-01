---
id: adtag-build
title: Build your ad tag
---

The ad tag is the javascript bundle that takes care of your ad setup.
You can split and optimize as you like, but for this getting started we build one
big bundle that contains everything.

## Replace the unconfigured ad tag

Your `index.html` contains a pre built ad tag that has no configuration.

```html
<script async="async" src="https://assets.h5v.eu/prebuilt/ad-tag/latest.js"></script>
```

The configuration is inlined on the page:

```javascript
// setup the command queue
window.moli = window.moli || {que: []};

// push callbacks into the queue
window.moli.que.push(function(adTag) {
    // on the fly configuration
    adTag.configure({
        environment: 'test',
        slots: [ /* ... */ ]
    });
});
```

We highly recommend adding the configuration into the ad tag and use typescript to
check for compilation errors.

How to setup an ad tag then? It's a javascript bundle that you can build with the tools
you like. `yarn` or `npm` as dependency management. `wepback` or `parcel` for minification.
For this tutorial we'll use `yarn` and webpack`.

## Sample project

:::important TODO
link example projects
:::

```bash
yarn init
yarn add @highfivve/ad-tag
```

:::important TODO
add webpack config
:::

## Prebid integration

### Inlined

:::important TODO
:::

### Separate webpack build

:::important TODO
:::
### Separate project

## Best practices

We have found a few things that worked really well for us.

### Immutable ad tags

We highly recommend to version your ad tag builds and always deploy a new bundle.
This is a little bit more effort, but comes with some nice benefits

1. You can easily roll back
2. You can cache the ad tag forever
3. You can a/b test different bundles
4. You can rollout incrementally

### Build ES5 and ES6 bundles

:::important TODO
:::
