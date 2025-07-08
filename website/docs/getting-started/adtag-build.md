---
id: adtag-build
title: Build your ad tag
---

The ad tag is the javascript bundle that takes care of your ad setup. It's like any other js library.
You can

* build a bundle through the `bundle.ts` as described in the [README.md](https://github.com/highfivve/moli-ad-tag/tree/main?tab=readme-ov-file#building-a-bundle)
* use a prebuilt ad tag from the [assets/bundle](https://github.com/highfivve/moli-ad-tag/tree/gh-pages/assets/bundle) on github pages ( not for prod though! )
* use it as an NPM dependency in your project

## Replace the unconfigured ad tag

Your `index.html` contains a pre built ad tag that has no configuration.

```html
<script async="async" src="https://highfivve.github.io/moli-ad-tag/assets/bundle/adtag.mjs"></script>
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
you like. `yarn` or `npm` as dependency management. `wepback`, `esbuild` or `rollup` for minification.

## Sample projects

The repo contains a [few sample projects](https://github.com/highfivve/moli-ad-tag/tree/main/examples) that you can use as a starting point.
