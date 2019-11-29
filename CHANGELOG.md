# Changelog

## Unreleased

### [GD-1613](https://jira.gutefrage.net/browse/GD-1613) Add passback support without passback slots.

Passback support can be enable by setting the `passbackSupport` property to `true` on an ad slot configuration.
This will cause a `window` message listener to be registered, which listens to certain passback events and
refreshs the ad slot if the proper event was sent while also setting two additional key-values `passback` to `true`
and `passbackOrigin` to the value sent in the message.

#### Example

The slot is configured as usual. Only the `passbackSupport` property is set to `true`. The `domId`
is important as it acts as the identifier for the ad slot where the passback should be triggered

```js
const slot = {
  domId: 'content-2',
  passbackSupport: true,
  // ... other settings
}
```

In the advertiser creative we need to define a passback function or whatever the advertiser gives
us that executes this code to trigger the passback feature.

```js
var request = {
  type: 'passback',
  domId: 'content-2',
  passbackOrigin: '<advertiser name>'
}
try {
  // first try to post a message on the top most window
  window.top.postMessage(JSON.stringify(request), '*');
} catch (_) {
  // best-effort postMessage
  window.postMessage(JSON.stringify(request), '*');
}
```

Note that we sent the json objects as strings, because Internet Explorer only supports strings.


#### A word on key values

Both key-values serve a purpose

- `passback` - the only value this can be set to is `true`. **All** line items that contain creatives that might trigger
  a passback need to have a targeting setting that says `NOT passback=true`. Otherwise we get infinite passback loops
- `passbackOrigin` - this key value contains the advertiser name how's creative triggered the passback. This allows us
  to get more detailed reports on how much each advertiser is responsible for passbacks
  

#### Impression tracking

We force the `correlator` to not be changed when we trigger a "passback refresh". Following the docs this should mean
that everything is still counted as a single page view, which is the correct way.

From the [gpt.js API documentation](https://developers.google.com/doubleclick-gpt/reference#refreshopt_slots,-opt_options)

> Configuration options associated with this refresh call. changeCorrelator specifies whether or not a new correlator is
> to be generated for fetching ads. Our ad servers maintain this correlator value briefly (currently for 30 seconds, but 
> subject to change), such that requests with the same correlator received close together will be considered a
> single page view. By default a new correlator is generated for every refresh. Note that this option has no effect
> on GPT's long-lived pageview, which automatically reflects the ads currently on the page and has no expiration time.


#### Resources

- [postMessage browser support](http://caniuse.com/#search=postMessage)
- [Mozilla MDN postMessage docs](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
- [Mozilla MDN Channel_Messaging_API](https://developer.mozilla.org/en/docs/Web/API/Channel_Messaging_API)

### [GD-1619](https://jira.gutefrage.net/browse/GD-1619) CMP Module

Refactor the consent feature into the module system. Faktor is now a CMP Module.

Breaking changes to the ad configuration are

- the `consent` property is now an empty object. A CMP module _should_ configure the `cmp` property there
- you must add a cmp module in order to make the ad tag work. See [the faktor cmp module](modules/faktor-cmp/README.md) 

## 1.28.0

[GD-1612](https://jira.gutefrage.net/browse/GD-1612) Confiant now requires way less configuration.

## 1.27.0

[GD-1583](https://jira.gutefrage.net/browse/GD-1583) Add option to throttle refreshable slots.

## 1.26.1

[GD-1577](https://jira.gutefrage.net/browse/GD-1577) Moli debugger and logger now show if there's no prebid instance when there is a prebid configuration 

## 1.26.0

[GD-1563](https://jira.gutefrage.net/browse/GD-1563) added `window` parameter to confiant module.

[GD-1563](https://jira.gutefrage.net/browse/GD-1563) added `assetLoaderService` to `init` function for modules.

[GD-1563](https://jira.gutefrage.net/browse/GD-1563) remove the `svornAssetUrl` from the moli config and replaced
it with a separate module. See [modules/sovrn-ad-reload](modules/sovrn-ad-reload/README.md) for more information.

## 1.24.0

[GD-1514](https://jira.gutefrage.net/browse/GD-1514) changed the prebid analytic adapter implementation into a module.
See [the readme for more info](modules/prebid-google-analytics/README.md).

## 1.23.0

> superseded by 1.24.0

## 1.22.0

[GD-1464](https://jira.gutefrage.net/browse/GD-1464) refactor the moli tag into a function `initAdTag`. This allows us
to better test global state on the `window` object. You need to change an ad tags code like this

```typescript
import { initAdTag } from '@highfivve/ad-tag'; import { adConfiguration } from "./configuration";

const moli = initAdTag(window);

// and then business as usual
moli.configure(adConfiguration);
```


## 1.20.4

[GD-1464](https://jira.gutefrage.net/browse/GD-1464) refactor the codebase to use yarn workspaces. This allows us
to better split the code base into separate pieces. At the moment we have

- [ad-tag](ad-tag) - the core ad tag library
- [modules](modules) - contains a separate workspace for each module
- [moli-debugger](moli-debugger) - the moli console code
- [examples](examples) - contains all the example projects

**Usage**

In your `package.json` you now need to specify the moli dependency with `@highfivve` as a name.

```json
{
  "dependencies": {
    "@highfivve": "ssh://git@git.gutefrage.net:7999/gd/moli-ad-tag.git#v1.20.4"
  }
}
```

Then in the `index.ts` of your ad tag you can write imports like this

```
// the ad tag
import { moli } from '@highfivve/ad-tag';

// modules
import Confiant from '@highfivve/modules/confiant';
```

Lastly, but very important you need to configure the `tsconfig.json` and add the new
paths otherwise you will get a very missleading error _ts emitted no output_.

```json
{
  "include": [
    "node_modules/@highfivve/ad-tag/source/**/*",
    "node_modules/@highfivve/modules/**/index.ts"
  ]
}
```

Note that we only import the `index.ts` and nothing else. This prevents compile errors, because
some types for mocha cannot be found for the tests, which we don't care for. Unless we find a fix
for this, we need to do it this way.



## 1.20.0

[GD-1391](https://jira.gutefrage.net/browse/GD-1391) change the `behaviour` type signature for an easier json representation.
Before, different variables were available directly on the ad slot object. Now everything is inside the `behaviour` property.

```javascript
// before
const adSlot = {
    domId: 'foo',
    behaviour: 'eager'
}

// after
const adSlot = {
    domId: 'foo',
    behaviour: {
        loaded: 'eager' 
    }
}
```

For `lazy` and `refreshable` slots the additional information is stored in the `behaviour` object.

```javascript
// before
const lazyAdSlot = {
    domId: 'foo',
    behaviour: 'lazy',
    trigger: { ... }
}

// after
const lazyAdSlot = {
    domId: 'foo',
    behaviour: {
        loaded: 'lazy',
        trigger: { ... } 
    }
}
```


```javascript
// before
const lazyAdSlot = {
    domId: 'foo',
    behaviour: 'refreshable',
    trigger: { ... },
    lazy: true
}

// after
const lazyAdSlot = {
    domId: 'foo',
    behaviour: {
        loaded: 'refreshable',
        lazy: true,
        trigger: { ... } 
    }
}
```


## v1.19.0

Don't request prebid/a9 if environment is `test`.

## v1.18.0

[GD-1354](https://jira.gutefrage.net/browse/GD-1354) timeout for faktor.io autoOptIn. Example:
```
cmpConfig: {
  provider: 'faktor',
  autoOptIn: true,
  timeout: 1
}
```

## v1.17.1

Filter sizes for dummy slots if ad tag is in `environment` test.

## v1.17.0

[GD-1342](https://jira.gutefrage.net/browse/GD-1342). The single page application mode now supports plain `lazy` slots.
We take care of registering and deregistering event listeners and make sure that a slot is only refreshed once per `requestAds()` call.

## v1.16.0

[GD-1342](https://jira.gutefrage.net/browse/GD-1342). The single page application mode now supports `lazy refreshable` slots
and the [examples/single-page-app](examples/single-page-app) contains a sophisticated react example that demonstrates the
various use cases.

## v1.15.0

Fix prebid usersync filter setting types. The propery value for wild cars is `*` and not `[*]`.
We need to change this in all new publisher tags.

```javascript
// before
const userSyncWrong = {
    userSync: {
        filterSettings: {
            image: {
                bidders: ['*'], // <-- this is an invalid configuration option
                filter: 'include'
            }
        }
    }
}

// after
const userSyncCorrect = {
    userSync: {
        filterSettings: {
            image: {
                bidders: '*',
                filter: 'include'
            }
        }
    }
}
```

The setting is usually in the `prebidConfig.ts`.

## v1.14.0

[GD-1307](https://jira.gutefrage.net/browse/GD-1307). A publisher can now register an `afterRequestAds()` hook, which
will trigger after the `requestAds()` call has finished. This makes it possible to fire events after all ad slots are
full configured and ads are being requested.

## v1.13.0

[GD-1160](https://jira.gutefrage.net/browse/GD-1160). The ad tag now handles `setTargeting` and `addLabel` calls
properly when the single page application mode is activated via `enableSinglePageApplication()`. The ad tag behaves
like this

1. The `labels` and `keyValues` from the static ad tag configuration are persistent. They are applied for every `refreshAds()` call
2. Labels added via `addLabel` and key-values via `setTargeting` are only valid for the next `refreshAds()` call

If a publisher sets key-values directly on `window.googletag.pubads().setTargeting(...)`, then those values will be
discarded on the **second** `refreshAds()` call. We don't recommend doing this anyway!

## v1.12.1

[GD-1326](https://jira.gutefrage.net/browse/GD-1326). The ad tag now checks the `window.location.href` in
single application mode if `requestAds()` can be triggered and throws an error otherwise. 

[GD-1325](https://jira.gutefrage.net/browse/GD-1325). This allows us to either force
a production or test environment, which eases the integration for the publisher.

- query parameter: `moliEnv`
- allowed values: `test` | `production`
                                                         
Example:
https://www.gutefrage.net/?moliEnv=test

[GD-1320](https://jira.gutefrage.net/browse/GD-1320). Before this implementation the DfpService waited until for the consent data
if `cmp` was used as a `PersonalizedAdsProvider` without any timeout. This effectively made the `a9` and `prebid` timeouts useless.

Now you have to specify a timeout for the `PersonalizedAdsProvider` if you choose `cmp`. Example:

```typescript
const consentConfig: Moli.consent.ConsentConfig = {
    personalizedAds: {
        provider: 'cmp',
        // timeout in milliseconds
        timeout: 500
    },
    cmpConfig: {
        provider: 'faktor',
        autoOptIn: true
    }
}
```

The timeout should usually match with the `a9` and `prebid` timeouts as they all use the same API and thus should
behave similar.

## v1.11.4

The `moli.getConfig()` method now returns the current configuration instead of always `undefined`. To avoid
future confusions the `moli.openConsole()` alerts if `undefined` is being returned by the `getConfig()` call.

## v1.11.3

Check if `pbjs` is available as well in single page application modus while destroying slots.

## v1.11.2

Made `pbjs.adUnits` property optional. This can happen when no prebid is configured.

## v1.11.1

[GD-1306](https://jira.gutefrage.net/browse/GD-1306). In addition we now filter all prebid ad units that neither
have a `banner` or `video` media type.

## v1.11.0

[GD-1306](https://jira.gutefrage.net/browse/GD-1306). If no prebid `banner` or `video` media  type is requested, then
the propery will be completely left out. The pubmatic adapter is broken when these properties are available, but `undefined`.

## v1.10.0

## Changed debug console asset path

[GD-1302](https://jira.gutefrage.net/browse/GD-1302). The new URL is https://ad-tag-console.h5v.eu/moli-debug.min.js

### Test Mode [](https://jira.gutefrage.net/browse/GD-1293)

An ad tag can now be configured in a `test` environment, which means that neither DFP, Prebid nor A9 will be called
and a placeholder ad will be rendered instead.

This allows for fast prototyping in the beginning without any setup in any ad server.

### Allow prebid userSync customization [GD-950](https://jira.gutefrage.net/browse/GD-950)

A publisher can decide if the prebid user syncs should be triggered after 6 seconds (default prebid configuration)
or after all ads have been loaded. Define the [`userSync`](https://moli-api-docs.gutefrage.net/interfaces/_moli_.moli.headerbidding.prebidconfig.html#usersync)
property in the `prebid` configuration.

This featured require a new service, the SlotEventService, which can be used to manage ad events in general.

### Improve Digital Single Request Mode

[GD-1296](https://jira.gutefrage.net/browse/GD-1296). Improve Digital now supports the prebid `bid.sizes` object,
which frees us from specifying the configuration on the SSP side and use labels to differentiate.

Example

```javascript
improvedigital: {
    singleRequest: true,
    usePrebidSizes : true
}
```

## v1.9.0

- Add dynamic way to create prebid listeners and upgrade dependencies ([GD-1278](https://jira.gutefrage.net/browse/GD-1278))
- Update npm dependencies [018e6f4a6](https://git.gutefrage.net/projects/GD/repos/moli-ad-tag/commits/018e6f4a62346b2706de944ea7dbc0aadd97b35a)

## v1.8.0

- Remove sizesSupport from global sizeConfig [GD-1148](https://jira.gutefrage.net/browse/GD-1148)
