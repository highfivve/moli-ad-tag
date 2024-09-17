---
title: Single Page Applications
---

Single Page Applications (SPA) are web applications that load a single HTML page and dynamically update that page as the
user interacts with the app. This approach allows for a more fluid user experience, but it also introduces some
challenges for ad serving as you have to manage state and lifecycle of the ads yourself.

The line between classic server-side rendered (SSR) websites and SPAs is blurring. Many websites are a mix of both as
frameworks like Next.js and Nuxt.js allow you to render pages on the server and then hydrate them on the client. There
are multiple different approaches to get the best of both worlds, with different trade-offs and complexities.

- SSR - Server-side rendering
- SSG - Static site generation
- SSR + CSR - Server-side rendering with client-side hydration
- CSR - Client-side rendering
- ISR - Incremental static regeneration
- SPA - Single page application
- Island Architecture

Here are some links that explain those concepts in more detail:

* [Server Islands are really cool (Video)](https://www.youtube.com/watch?v=uBxehYwQox4)
* [next.js server-side rendering](https://nextjs.org/docs/pages/building-your-application/rendering/server-side-rendering)
* [choose your rendering method spa vs ssr vs ssg](https://dev.to/crunchstack/choose-the-rendering-method-spa-vs-ssr-vs-ssg-121f)
* [astro islands](https://docs.astro.build/en/concepts/islands/)

## Main Challenge

The main challenge with user navigation without a real page reload is the state management. This includes

* Remove existing ad slots after page navigation
* Add new ad slots after page navigation
* Refresh ad slots after the necessary component is mounted
* Remove dynamic targeting and key-values from the previous page
* Add dynamic targeting and key-values for the new page

## Solution

On a server-side rendered website ad loading is either triggered by

* a config setting `requestAds: true` in the `moliConfig` or
* by calling `window.moli.requestAds()` in the JavaScript code if is `requestAds: false`

On a single page application, you **always** have to call `window.moli.requestAds()`. The first time the page is loaded
and after every page navigation. It tries to mimic a real page refresh and handles all cases mentioned above. All
javascript frameworks that support client-side rendering have route change events that you can hook into.

The second part is that you have to refresh the ad slots after the necessary component is mounted. This is usually done
by implementing an `Ad` component that calls `window.moli.refreshAdSlot('div-id')` in the `componentDidMount` lifecycle
or `useEffect` hook.

A very basic ad component may look like this:

```tsx
import React, { useEffect } from 'react';

const Ad = ({ id }) => {
  useEffect(() => {
    window.moli.refreshAdSlot(id);
  }, [id]);

  return <div id={id} />;
};
```

## State Management

It's a lot easier to mess up refreshing ad slots in an SPA than on a server-side rendered website. Refreshing ad slots
multiple times can happy by accident due to unexpected re-renders. This behaviour should be avoided at all costs as it
devalues the ad inventory and can be classified as ad fraud.

The default `spa` configuration looks like this

```ts
const moliConfig: Moli.Config = {
  slots: [ /* ... */],
  requestAds: false,
  // highlight-start
  spa: {
    enabled: true,
    validateLocation: 'href'
  },
  // highlight-end
};
```

The `validateLocation` property defines what URL change determines a page navigation. The default value is `'href'`.
Possible configuration values are

* `'href'` - The full URL changes (default)
* `'pathname'` - Only the path changes. Use this if you use query params and anchors that do not change the actual page.
               A common example are filter parameters in a shop or cursor parameters in an infinite list.
* `'none'` - Nothing is checked ⚠ not recommended. There are no safeguards at all

Here is [the full documentation of all values](../api/types/moliConfig/namespaces/spa/interfaces/SinglePageAppConfig.md#validatelocation).

The definition of a navigation change is important for basic safeguards

1. `moli.requestAds()` can only be called once per page navigation. This ensures that ad slots are not created and
   destroyed multiple times and targeting state is not overridden or lost.
2. `moli.refreshAdSlot()`, `moli.refreshInfiniteAdSlot()`, `moli.refreshBucket()` either queues the refresh call or directly refreshes the ad slot.

### requestAds

You should call `window.moli.requestAds()` after every page navigation. This ensures that all ad slots are removed and
state is reset. It also refreshes all ad slots that have been queued through `moli.refreshAdSlot()`, `moli.refreshInfiniteAdSlot()` or `moli.refreshBucket()` calls.

:::tip

If you have page view tracking in place, then call `requestAds()` at the exact place as these two calls should match.

:::

### refreshAdSlot / refreshInfiniteAdSlot / refreshBucket

The refresh calls have two response types: `queued` and `refreshed`. The response depends on the `validateLocation`,
the current navigation state and if `requestAds()` has already been called. This examples demonstrates a common scenario.

Configuration: `validateLocation: 'href'`

| URL      | `requestAds()` | `refreshAdSlot()` | Response  | Explanation                                                                                                    |
|----------|----------------|------------------|-----------|----------------------------------------------------------------------------------------------------------------|
| /home    | not called     | `div-id`          | queued    | waiting for `requestAds()`                                                                                     |
| /home    | called         | `div-id`          | refreshed | still on the same page. Ad slot can be refreshed immediately                                                   |
| /profile | not called     | `div-id`          | queued    | user has navigated to a new page. Ad slot is queued                                                            |
| /profile | called         | `div-id`          | refreshed | `requestAds()` has been called. Queued slots are refreshed and all subsequeuent calls are refreshed immediatly |

### addLabel / setTargeting

The `addLabel` and `setTargeting` calls are not affected directly by the `validateLocation` setting. Every `requestAds()`
persists the labels and targeting values set for the current page. All subsequent `addLabel` and `setTargeting` calls
are stored for the next `requestAds()` call.

:::tip

Labels and targeting key-values from the `MoliConfig` are permanent. If you need permanent labels or targeting key values
you have to set them again before every `requestAds()` call. We recommend doing this on the publisher side, directly before
the `requestAds()` call, e.g.

```ts
window.moli.addLabel('mobile');
window.moli.setTargeting('key', 'value');
window.moli.requestAds();
```

The other option is the `beforeRequestAds()` hook that is called before every `requestAds()` call.

```ts
window.moli.beforeRequestAds(() => {
  window.moli.addLabel('mobile');
  window.moli.setTargeting('key', 'value');
});
```

:::
