# Changelog

## Unreleased

## 3.37.7

[GD-3437](https://jira.gutefrage.net/browse/GD-3437), [GD-3438](https://jira.gutefrage.net/browse/GD-3438): Adex module:
Support list object type, warn about defaultValue usage

[GD-3428](https://jira.gutefrage.net/browse/GD-3428) / [GD-3431](https://jira.gutefrage.net/browse/GD-3431): Moli
Debugger: Added bucket config check + added skin config check + render the bucket name

## 3.37.5

[GD-3435](https://jira.gutefrage.net/browse/GD-3435) Add gpt-pre-auction module types, add refreshFpd method to pbjs

## 3.37.4

[GD-3534](https://jira.gutefrage.net/browse/GD-3534): Abort ad pipeline if slots are empty after filtering.

## 3.37.3

[GD-3548](https://jira.gutefrage.net/browse/GD-3548): Add disableVisibilityChecks parameter to Ad Reload, allowing to
reload out-of-viewport ads.

## 3.37.2

[GD-3437](https://jira.gutefrage.net/browse/GD-3437), [GD-3438](https://jira.gutefrage.net/browse/GD-3438): Remove
necessity to supply a logger in Adex module constructor.

## 3.37.1

[GD-3437](https://jira.gutefrage.net/browse/GD-3437), [GD-3438](https://jira.gutefrage.net/browse/GD-3438): Hotfix
release telling GitHub to use Node v16.

## 3.37.0

[GD-3437](https://jira.gutefrage.net/browse/GD-3437), [GD-3438](https://jira.gutefrage.net/browse/GD-3438): Add The Adex
DMP module to moli.

```javascript
import { AdexModule } from '@highfivve/module-the-adex-dmp';

moli.registerModule(new AdexModule({
  mappingDefinitions: [{ adexValueType: 'string', key: 'channel', attribute: 'iab_cat' }],
  adexCustomerId: '1234',
  adexTagId: '1337',
  spaMode: false // non-spa web project
}, window));
```

## 3.36.1

[GD-3279](https://jira.gutefrage.net/browse/GD-3279) Set `upr_browser` as key value on global targeting, not per ad slot.

## 3.36.0

[GD-3279](https://jira.gutefrage.net/browse/GD-3279) Set `upr_browser` as key value in yield optimization to detect
browser discrepancies.

## 3.35.16

Add `data-google-query-id` to ad slots in test mode so custom CSS that checks for this attribute works.

## 3.35.15

[GD-3270](https://jira.gutefrage.net/browse/GD-3270) Add enum types for `mediaType.video` parameters.

```javascript
import { prebidjs } from '@highfivve/ad-tag';
import video = prebidjs.video;

const mediaTypes =    {
  mediaTypes: {
    video: {
      context: 'outstream',
      playerSize: [605, 340],

      // ----- this is new --------
      mimes: ['video/mp4', 'video/MPV', 'video/H264', 'video/webm', 'video/ogg'],

      // start delay should be 1sec so Criteo doesn't break
      startdelay: 1,
      minduration: 1,
      maxduration: 30,
      playbackmethod: [
        video.PlaybackMethod.AutoPlaySoundOff,
        video.PlaybackMethod.ClickToPlay,
        video.PlaybackMethod.MousOver,
        video.PlaybackMethod.InViewportSoundsOff,
        video.PlaybackMethod.InViewportSoundsOn
      ],
      placement: video.Placement.InBanner,
      api: [
        video.Api.VPAID_1,
        video.Api.VPAID_2,
        video.Api.MRAID_1,
        video.Api.MRAID_2,
        video.Api.MRAID_3,
        video.Api.ORMMA
      ],
      protocols: [
        video.Protocol.VAST_1,
        video.Protocol.VAST_1_WRAPPER,
        video.Protocol.VAST_2,
        video.Protocol.VAST_2_WRAPPER,
        video.Protocol.VAST_3,
        video.Protocol.VAST_3_WRAPPER,
        video.Protocol.VAST_4,
        video.Protocol.VAST_4_WRAPPER
      ],
      skip: video.Skip.YES
    }
  }
};

```

## 3.35.14
[GD-3459](https://jira.gutefrage.net/browse/GD-3459) Add `mv` (mobile video) and `as` (footer pushup leader board) key value for just premium format filter.

## 3.35.13
[GD-3459](https://jira.gutefrage.net/browse/GD-3459) Add `ms` (mobile sticky expandable) key value for just premium format filter.

## 3.35.12
[GD-2755](https://jira.gutefrage.net/browse/GD-2755) Add floor price currency conversion for a9.
We use the currency conversion provided by prebid if available. Otherwise, the exchange rate defaults to `1.19`

## 3.35.10

[GD-3293](https://jira.gutefrage.net/browse/GD-3293) Remove requirement for a single playerSize for prebid video. Moli
now correctly handles if zero, one, or multiple sizes are set for playerSize.

Also, the `w` and `h` properties on the prebid `mediaType.video` are now inferred from the first given size, if not
explicitly specified.

## 3.35.9

[GD-3350](https://jira.gutefrage.net/browse/GD-3350). Add `priceRule` to the `PrebidAdSlotContext`. This enables access
to all price rule information for analytics. The `floorPrice` property is also deprecated, use `context.priceRule.floorprice` now.

## 3.35.8

[GD-3348](https://jira.gutefrage.net/browse/GD-3348) In the moli debugger, use prebid config value for
`userSync.syncEnabled` property when it's omitted from moli config (and therefore using the `true` default from prebid)

## 3.35.7

[GD-3231](https://jira.gutefrage.net/browse/GD-3231) Add `allowTargetingKeys` to the prebid `targetingControls` config.

In [#6485](https://github.com/prebid/Prebid.js/issues/6485) prebid.js made `hb_source` an optional parameter, which is
required if you want to distinguish between client and server side traffic. For Prebid 5.x add this to the prebid config

```javascript
const targetingControls = {
  targetingControls: {
    alwaysIncludeDeals: true,
    allowTargetingKeys: [
      'BIDDER',
      'AD_ID',
      'PRICE_BUCKET',
      'SIZE',
      'DEAL',
      'SOURCE',
      'FORMAT',
      'CACHE_ID',
      'CACHE_HOST'
    ]
  }
}
```



## 3.35.5

[GD-3231](https://jira.gutefrage.net/browse/GD-3231) Add more `mediaType.video` params.

[GD-3231](https://jira.gutefrage.net/browse/GD-3231) Make `params.size` optional for index exchange and allow `number` for `params.siteId`

## 3.35.4

[GD-3231](https://jira.gutefrage.net/browse/GD-3231) Add `detectMissingSizes` config parameter for index exchange.

See https://github.com/prebid/Prebid.js/pull/5856

## 3.35.3

[GD-3270](https://jira.gutefrage.net/browse/GD-3270) Add additional parameters to `mediaTypes.video`.
There are new params that need to be set. This is a sensible default:

```javascript
const mediaTypes =    {
  mediaTypes: {
    video: {
      context: 'outstream',
      playerSize: [605, 340],

      // ----- this is new --------
      mimes: ['video/mp4', 'video/MPV', 'video/H264', 'video/webm', 'video/ogg'],
      minduration: 1,
      maxduration: 30,
      playbackmethod: [2, 3, 4, 5, 6],
      placement: 2, // placement 2 means in-banner
      api: [1, 2, 3, 4, 5, 6]
    }
  }
};
```

Note that all the numbers are not really nice to use, and you have to look up everything in the
docs or the OpenRTB spec. Maybe these will become enums in the future.

## 3.35.2

[GD-3322](https://jira.gutefrage.net/browse/GD-3322) Fix single page application targeting

## 3.35.0

[GD-3313](https://jira.gutefrage.net/browse/GD-3313) Sanitize `adUnitPath` for `slotName`. Child network id is removed
[GD-3319](https://jira.gutefrage.net/browse/GD-3319) Add `vlyby` prebid adapter types

## 3.34.5

[GD-3202](https://jira.gutefrage.net/browse/GD-3202) `mkConfigureStepOnce` take `requestAdsCalls` and `requestId` into account

## 3.34.4

[GD-3202](https://jira.gutefrage.net/browse/GD-3202) Run `aps.upa()` only when required.

## 3.34.3

- [GD-3273](https://jira.gutefrage.net/browse/GD-3273) Fixed wrong scope for publisher name on overview page

## 3.34.2

- [GD-3274](https://jira.gutefrage.net/browse/GD-3274) Improve testability of changes made to overview.hbs in moli-release
- [GD-3273](https://jira.gutefrage.net/browse/GD-3273) Show ES5 + ES6 bundle URLs on publisher overview page

## 3.34.1

[GD-3202](https://jira.gutefrage.net/browse/GD-3202) Run `aps.upa()` only once per page load.

## 3.34.0

[GD-3202](https://jira.gutefrage.net/browse/GD-3202) Add Amazon Publisher Audiences feature.

Configurable via the `A9Config`

```js
const moliConfig = {
  // ...
  a9: {
    // standard configuration
    pubID: 'xxxx',
    timeout: 2000,
    cmpTimeout: 500,

    // optional publisher audience configuration
    publisherAudience: {
      enabled: true,
      sha256Email: 'xxxxyyyyzzzzz'
    }
  }
}
```

## 3.33.3

[GD-3129](https://jira.gutefrage.net/browse/GD-3129) Change adform biddercode to `adf`

## 3.33.2

[GD-3207](https://jira.gutefrage.net/browse/GD-3207) Fix a9 blocking the ad pipline if consent is missing

## 3.33.1

[GD-2570](https://jira.gutefrage.net/browse/GD-2570). Add prebuilt ad tag.

## 3.33.0

[GD-2996](https://jira.gutefrage.net/browse/GD-2996). Yield optimization module now works with `adUnitPath` instead
of `domID`. Requires no change in the ad tag.

## 3.32.9

- Remove `useMoliPbjs` setting
- Add *EMX Digital* bidder code
- Add *Triplelift* bidder code

## 3.32.7

[GD-3161](https://jira.gutefrage.net/browse/GD-3161). Add `video` params for Pubmatic bidder.
See [Video parameters](https://docs.prebid.org/dev-docs/bidders/pubmatic#video-parameters).

## 3.32.6

[GD-3153](https://jira.gutefrage.net/browse/GD-3153). Add `isMobile` and `labels` to the `PrebidAdSlotContext`.
This allows to perform logic in the `adUnit` creation, when using the context.

Example: Different stored impression ids

```javascript
const adSlot = {
  domId: 'content_1',
  // ...
  prebid: context => {
    return {
      adUnit: {
        ortb2Imp: {
          ext: {
            prebid: {
              storedrequest: `content_1.${context.isMobile ? 'mobile' : 'desktop'}`
            }
          }
        },
      }
    };
  }
};
```

## 3.32.5

[GD-3151](https://jira.gutefrage.net/browse/GD-3151). Migrate moli-debugger to React, fix bugs, visual glitches, and warnings.

## 3.32.4

[GD-3132](https://jira.gutefrage.net/browse/GD-3132). Add `video` params to smart ad server bidder.

## 3.32.3

[GD-2840](https://jira.gutefrage.net/browse/GD-2840). Fix displayed filenames on releases overview page.

## 3.32.2

[GD-3121](https://jira.gutefrage.net/browse/GD-3121). Add `ortb2Imp` property typings for prebid ad unit.

```javascript
const adUnit = {
  adUnit: {
    code: 'pos1',
    // ...
    ortb2Imp: {
      ext: {
        prebid: {
          storedrequest: {
            id: 'pos1'
          }
        }
      }
    }
  }
};
```

## 3.32.1

[GD-2840](https://jira.gutefrage.net/browse/GD-2840): Use a config object for makeDocsPages function.

## 3.32.0

[GD-2840](https://jira.gutefrage.net/browse/GD-2840): Moli core and modules are now published as ES6 to github npm registry.

## 3.31.4

[GD-2840](https://jira.gutefrage.net/browse/GD-2840): Update overview page with ES6 + ES5 ad tags.

## 3.31.3

[GD-1363](https://jira.gutefrage.net/browse/GD-1363). No CMP is required in `test` environment.

## 3.31.2

[GD-3121](https://jira.gutefrage.net/browse/GD-3121). Change `s2sConfig` types to match [#6484](https://github.com/prebid/Prebid.js/pull/6484).

## 3.31.1

[GD-2840](https://jira.gutefrage.net/browse/GD-2840): Enable releasing moli as ES5+ES6

## 3.31.0

[GD-2965](https://jira.gutefrage.net/browse/GD-2965) Override refresh interval by slot.

Use the `refreshIntervalMsOverrides` to specify a config object with `domID` to `refreshInterval` mapping.

```typescript
new AdReload(
  {
    refreshIntervalMs: 20000,
    refreshIntervalMsOverrides: {
      // slot-1 will have a refresh interval of 10000
      'slot-1': 10000
    }
    // ...
  },
  window
)
```

[GD-3080](https://jira.gutefrage.net/browse/GD-3080) Add prebidjs types for Adform.

## 3.30.0

[GD-3068](https://jira.gutefrage.net/browse/GD-3068) Add `upr_model` targeting to yield optimization module.

## 3.29.5 / 3.29.6

[GD-3027](https://jira.gutefrage.net/browse/GD-3027) / [GD-1946](https://jira.gutefrage.net/browse/GD-1946) Add `BidWon` event for `pbs.onEvent('bidWon', callback)`.

In your ad tag you can now

```typescript
import {  prebidjs } from '@highfivve/ad-tag';

declare const window: Window & prebidjs.IPrebidjsWindow;

window.pbjs.onEvent('bidWon', (bidWon: prebidjs.event.BidWonEvent)  => {
  console.log(bidWon);
});

```

## 3.29.3

[GD-2699](https://jira.gutefrage.net/browse/GD-2699) Purpose types in moli ad tag

Defined `TCPurpose` enum to check if consent is given.

## 3.29.2

[GD-2950](https://jira.gutefrage.net/browse/GD-2950) Add new formats for just premium

* Video Wallpaper: `wv`
* Video Floor Ad: `fv`

## 3.29.1

[GD-2808](https://jira.gutefrage.net/browse/GD-2808) Ad reload CLS optimization now removes "fluid" size when reloading.

## 3.29.0

[GD-2808](https://jira.gutefrage.net/browse/GD-2808) Ad reload now sets fixed heights on configured slots before
reloading them, and only requests sizes with the same or lower height on reload to not affect the site's CLS score.

[GD-2952](https://jira.gutefrage.net/browse/GD-2952) Add new bidder `AdUp` technology types.

## 3.28.0

[GD-2829](https://jira.gutefrage.net/browse/GD-2829) Honor use `code` property in prebid adunit, but make it optional.
Fallback is the `domID`.

Additional properties in the `adUnit` are now passed along and not filtered out.


## 3.27.4
[GD-2835](https://jira.gutefrage.net/browse/GD-2835) Allow creation of adSlot with anchor position without existing element in the dom.

## 3.27.3
[GD-2835](https://jira.gutefrage.net/browse/GD-2835) Added `out-of-page-top-anchor` and `out-of-page-bottom-anchor` positions.

## 3.27.2

[GD-2814](https://jira.gutefrage.net/browse/GD-2814) Add `supportedSizes` to a9 configuration to filter sizes we don't want to include in the requests.

## 3.27.0

[GD-2495](https://jira.gutefrage.net/browse/GD-2495) Improved types and functions around prebid-outstream player

## 3.26.2 / 3.26.3

[GD-2807](https://jira.gutefrage.net/browse/GD-2807). Add `moli.version` property to access the moli version

## 3.26.1

[GD-2777](https://jira.gutefrage.net/browse/GD-2777) Remove pubstack SDK stub.

## 3.26.0

[GD-2495](https://jira.gutefrage.net/browse/GD-2495) Added types and support for the prebid-outstream player.

```ts
adUnit: {
  mediaTypes: {
    video: {
      renderer: prebidOutstreamRenderer('prebid-adslot')
    }
  }
}
```

## 3.25.0 / 3.25.1

[GD-2735](https://jira.gutefrage.net/browse/GD-2735). Add Amazon A9 / TAM floor price configuration.
This needs to be enabled explicitly as this is currently in beta

```javascript
{
  a9: {
    // ...
    enableFloorPrices: true,
    floorPriceCurrency: 'EUR'
  }
}
```


[GD-2728](https://jira.gutefrage.net/browse/GD-2728). Fix bug that breaks moli if gdpr does not apply

## 3.24.0

[GD-2716](https://jira.gutefrage.net/browse/GD-2716). Don't call prebid `requestBids` if all slots are filtered,
otherwise key values may be discarded that should actually be sent to the ad server. [resetPresetTargeting](https://github.com/prebid/Prebid.js/blob/fdd646b379e475a861f847cb51adf34b951b7dba/src/prebid.js#L313)
seems to treat `undefined` as "all ad units".

## 3.23.5

Ad tags now require the `webpack-manifest-plugin` plugin.

```bash
yarn add --dev webpack-manifest-plugin
```

Add this to the `webpack.config.js`

```javascript
const {
  makeDocsPages,
  manifestPlugin
} = require('@highfivve/moli-release/releases/webpack-helpers');
```

and add the `manifestPlugin` to your plugins

```javascript
plugins: [
  ...makeDocsPages(publisherName, releasesJson.currentFilename, __dirname),
  manifestPlugin(),
  // ...
]
```

## 3.23.3

Make yieldlab `adSize` parameter optional.

## 3.23.2

[GD-2693](https://jira.gutefrage.net/browse/GD-2693) Clear a9 key values only if present. This removes warnings in the googletag console.

## 3.23.1

[GD-2696](https://jira.gutefrage.net/browse/GD-2696) Set `consent` key-value if at least one purpose consent is missing.
This allows a simple targeting in the ad server if no full consent is available.

This remains until google has a more standardized and working way than the [ad technology providers](https://support.google.com/admanager/answer/9835267?hl=en).

## 3.22.3

[GD-2671](https://jira.gutefrage.net/browse/GD-2671) Load apstag.js (Amazon A9) only if consent is given for the purposes defined by Amazon.

## 3.22.0

[GD-2616](https://jira.gutefrage.net/browse/GD-2616) While being in the test environment, hiding test slots is persisted in lcoal storage.

## 3.21.0

[GD-2664](https://jira.gutefrage.net/browse/GD-2664) Make collapseEmptyDiv configurable in the ad slot configuration.

```javascript
{
  gpt: {
    collapseEmptyDiv: false
  }
}
```

## 3.20.0

[GD-2502](https://jira.gutefrage.net/browse/GD-2502). Add option to disable ad slot bucketing. In the moli config add

```javascript
buckets: {
  enabled: false
}
```

By default `buckets` are disabled.

## 3.19.0

[GD-2518](https://jira.gutefrage.net/browse/GD-2518) Improvements to ad slot debugging

- Refactored fake ad slots in test environment.
- The last manually selected size of a fake ad slot is saved in local storage and applied automatically.
- Fake ad slots can be hidden via their "hide" button.
- Added the ability to delay ad slots in the test environment.

## 3.18.0

[GD-2641](https://jira.gutefrage.net/browse/GD-2641). Add the ability to filter size configs via labels.

```javascript
sizeConfig: [
  {
    mediaQuery: '(min-width: 768px)',
    sizesSupported: [ [728, 90], [800, 250] ]
  },
  {
    mediaQuery: '(min-width: 768px)',
    sizesSupported: [ [970, 250] ],
    labelAll: [ 'home' ]
  }
]
```

## 3.17.0

[GD-2615](https://jira.gutefrage.net/browse/GD-2615) Environment override is configurable from local storage and
session storage. Also the override can be toggled in the moli debugger.

## 3.16.1

[GD-2447](https://jira.gutefrage.net/browse/GD-2447) Only load Zeotap ID+ on first call in SPA mode.

## 3.16.0

[GD-2502](https://jira.gutefrage.net/browse/GD-2502). Implement loading eager slots in buckets.

Some prebid bidders are a bit sensitive when it comes to loading many placements at once.
Therefore, it is recommended to partition the loading of eager slots into buckets of 4 or 5.

## 3.15.0

[GD-2608](https://jira.gutefrage.net/browse/GD-2608). Add `purpose-1` label to the supported labels if consent for
purpose 1 is given. This allows filtering prebid partners if they don't obey the user consent choices.

Usage:

```typescript
const dspxBid = (placement: string): prebidjs.IDSPXBid => {
  return {
    bidder: prebidjs.DSPX,
    params: { placement },
    labelAll: [prebidjs.DSPX, 'purpose-1']
  };
};
```

## 3.14.15

[GD-2548](https://jira.gutefrage.net/browse/GD-2548). Add check for `getModuleMeta` function to moli debugger. This
ensures compatibility with old moli API versions.

## 3.14.14

[GD-2548](https://jira.gutefrage.net/browse/GD-2548). Show configured modules of the ad tag in moli debugger.

## 3.14.13

[GD-2346](https://jira.gutefrage.net/browse/GD-2346). Fixed pushing tags in moli-release.

## 3.14.11

[GD-2346](https://jira.gutefrage.net/browse/GD-2346). Added publisher name to releases.json in moli-release to have unique git tags.

## 3.14.10

[GD-2346](https://jira.gutefrage.net/browse/GD-2346). The default commit messages now only include only the ones until the last tag.

## 3.14.9

[GD-2346](https://jira.gutefrage.net/browse/GD-2346). Remove `overview.hbs` check from moli-release as it now ships this
file by default.

## 3.14.8

[GD-1363](https://jira.gutefrage.net/browse/GD-1363). Pack releases/ folder into moli-release module.

## 3.14.7

[GD-1363](https://jira.gutefrage.net/browse/GD-1363). Add missing bash env line to make moli-release bin executable.

## 3.14.6

[GD-1363](https://jira.gutefrage.net/browse/GD-1363). Remove extra moli-release binary file.

## 3.14.5

[GD-1363](https://jira.gutefrage.net/browse/GD-1363). Small improvements for published node modules:

* Correct paths for moli-ad-tag module
* Include "bin" property in moli-release module

## 3.14.4

[GD-2581](https://jira.gutefrage.net/browse/GD-2581). Run `beforeRequestAds` hooks in single page app mode for every
`requestAds` call.

## 3.14.3

[GD-2581](https://jira.gutefrage.net/browse/GD-2581). Allow multiple `beforeRequestAds` and `afterRequestAds` hooks.

## 3.14.2

[GD-2578](https://jira.gutefrage.net/browse/GD-2578). Add `tags` property to pubstack type.

## 3.14.0, 3.14.1

[GD-2010](https://jira.gutefrage.net/browse/GD-2010). Implement Google Ad Manager [Limited Ads](https://support.google.com/admanager/answer/9882911)
variant. This change requires the following changes on the publisher side

1. Remove the `gpt.js` in the `head` tag. Depending on the given consent the ad tag will decide, which `gpt.js` should be loaded.
2. The `sourcepoint cmp` module is gone, and a TCF 2 spec compliant implementation is part of the ad tag

## 3.13.2

[GD-2558](https://jira.gutefrage.net/browse/GD-2558). Add DOM id to test mode creative

## 3.13.1

[GD-2313](https://jira.gutefrage.net/browse/GD-2313) Fix label configuration

## 3.13.0

[GD-2313](https://jira.gutefrage.net/browse/GD-2313) Yield Optimization is now a module and needs to be configured as such.

See [module README](modules/yield-optimization/README.md);

## 3.12.2

[GD-2447](https://jira.gutefrage.net/browse/GD-2447) Add IZeotapIdPlusIdProvider to UserIdProviders

## 3.12.1

[GD-2447](https://jira.gutefrage.net/browse/GD-2447) Add possibility to configure Zeotap script params with an include
list for key/values, and to prevent data collection using an exclude list.

## 3.12.0

[GD-2447](https://jira.gutefrage.net/browse/GD-2447) Zeotap module added, supporting their data collection and id
provider functionality ([idplus](https://idplus.io/)).

[GD-2506](https://jira.gutefrage.net/browse/GD-2506) Ensure that display is only called once.

## 3.11.6

[GD-2488](https://jira.gutefrage.net/browse/GD-2488) Native `icon` property now has `sizes` and `aspect_ratios` as well.
`sizes` is now a size `[number, number]` or and array of sizes `[number, number][]`.

## 3.11.5

[GD-2488](https://jira.gutefrage.net/browse/GD-2488) Add len property to specify maximum number of characters for native ads. This is required for prebid native

## 3.11.0 - 3.11.4

[GD-2488](https://jira.gutefrage.net/browse/GD-2488). Adds typings for prebid s2s config.

## 3.10.0

[GD-2460](https://jira.gutefrage.net/browse/GD-2460). Added a new `position` `out-of-page-interstitial`.
See [google ad manager traffic web interstitials](https://support.google.com/admanager/answer/9840201) for more information.

A web interstitial requires very little configuration:

```javascript
const slot = {
  // domId is irrelevant (better typings may make this optional)
  domId: 'unused',
  position: 'out-of-page-interstitial',
  // should always be loaded eagerly
  behaviour: {
    loaded: 'eager'
  },
  // google test ad unit
  adUnitPath: '/6355419/Travel/Europe/France/Paris',
  // neither size nor sizeConfig is needed.
  sizes: [],
  sizeConfig: []
};
```

## 3.9.13

[GD-1355](https://jira.gutefrage.net/browse/GD-1355)

↪ [GD-2486](https://jira.gutefrage.net/browse/GD-2486) Implement user activity control modes for ad reload module
(strict, moderate, lax, custom)

## 3.9.12

[GD-2468](https://jira.gutefrage.net/browse/GD-2468) Add recognified types

## 3.9.11

[GD-2416](https://jira.gutefrage.net/browse/GD-2416) Move a9 clear targeting to ad tag core

## 3.9.10

[GD-2424](https://jira.gutefrage.net/browse/GD-2424) Add Visx types

`bidderSettings` are also more generic.

## 3.9.8

[GD-1363](https://jira.gutefrage.net/browse/GD-1363) Publish Moli Ad Tag library to GitHub NPM registry

### Authentication
[See](https://docs.github.com/en/free-pro-team@latest/packages/using-github-packages-with-your-projects-ecosystem/configuring-npm-for-use-with-github-packages)

Add the .npmrc file to publisher project, so that we can install the package from the github npm registry.
As long as we have a private github repository we need to add the authToken (currently personal token).

```
@highfivve:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken={TOKEN}
always-auth=true
registry=https://registry.npmjs.org
```


### Publish moli packages

Using lerna for managing multi-package repository. [Lerna on Github](https://github.com/lerna/lerna)

Add a dependency to a package
```
lerna add <package>
```

Link local packages together and install remaining package dependencies
```
lerna bootstrap
```

Run a npm script in each package that contains that script
```
lerna run <script>
// e.g.
lerna run make:nodemodule
```

Bump version of packages changed since the last release
```
lerna version
```

Publish packages in the current project
```
lerna publish from-package --registry https://npm.pkg.github.com/
```
### Installing moli packages

```
yarn add @highfivve/ad-tag
```

# 3.9.7

[GD-2346](https://jira.gutefrage.net/browse/GD-2346) Add currentFilename to makeDocsPages function and handlebars data

## 3.9.6

[GD-2346](https://jira.gutefrage.net/browse/GD-2346) Add handlebars-related stuff (helpers, build utils, partials) to
moli-release (instead of inside publisher tag repository)

## 3.9.5

[GD-2346](https://jira.gutefrage.net/browse/GD-2346) Add auto-generated ad tag filename to releases.json when running moli-release

## 3.9.4

[GD-1355](https://jira.gutefrage.net/browse/GD-1355) Don't send sovrn-reload key/value anymore for native ad reload

## 3.9.3

[GD-2346](https://jira.gutefrage.net/browse/GD-2346) Log errors from inquirer in moli-release script

## 3.9.0

[GD-2346](https://jira.gutefrage.net/browse/GD-2346) Re-built moli release CLI with framework

## 3.8.4

[GD-1355](https://jira.gutefrage.net/browse/GD-1355)

↪ [GD-2416](https://jira.gutefrage.net/browse/GD-2416) Use PrepareRequestAdsStep instead of ConfigureStep for clearing A9 targeting

## 3.8.3

[GD-2417](https://jira.gutefrage.net/browse/GD-2417) Make reload key/value key configurable (default stays at `native-ad-reload`)

## 3.8.2

[GD-1355](https://jira.gutefrage.net/browse/GD-1355)

↪ [GD-2416](https://jira.gutefrage.net/browse/GD-2416) Clear A9 targeting (`amznp`, `amznsz`, `amznbid`) on googletag slot when triggering a native slot reload
↪ [GD-2417](https://jira.gutefrage.net/browse/GD-2417) Set separate key/value `native-ad-reload` on googletag slot when reloading

## 3.8.1

[GD-2415](https://jira.gutefrage.net/browse/GD-2415). `moli.refreshAdSlot` now takes a single domID string or an array of domID strings.

```js
// still works, but triggers 3 auctions
moli.refreshAdSlot('content_x');
moli.refreshAdSlot('content_3');
moli.refreshAdSlot('content_4');

// triggers a single auction
moli.refreshAdSlot([ 'content_x', 'content_3', 'content_4' ]);
```

## 3.8.0

[GD-2412](https://jira.gutefrage.net/browse/GD-2412) Remove prebid labels in moli ad tag.
This fixes Sovrn and all possible third party scripts that rely on the configured `pbjs.adunits`.

## 3.7.6

[GD-2346](https://jira.gutefrage.net/browse/GD-2346) Fixed package.json resolving problem

## 3.7.5

[GD-2346](https://jira.gutefrage.net/browse/GD-2346) moli-release command is not in workspace anymore

## 3.7.4

[GD-2346](https://jira.gutefrage.net/browse/GD-2346) Added moli-release CLI

## 3.7.3

[GD-2345](https://jira.gutefrage.net/browse/GD-2345) Move IdentityLink types to module, explicitly cast `Window`
to `ATS.Window` in constructor

[GD-1355](https://jira.gutefrage.net/browse/GD-1355) Update IE11 example docs

## 3.7.2

[GD-2345](https://jira.gutefrage.net/browse/GD-2345): Add IIdentityLinkProvider to UserIdProvider union type

## 3.7.1

[GD-2345](https://jira.gutefrage.net/browse/GD-2345): Add pixelID parameter to LiveRamp module config

## 3.7.0

[GD-2345](https://jira.gutefrage.net/browse/GD-2345): Integrate LiveRamp ATS IdentityLink solution

## 3.6.6

[GD-1355](https://jira.gutefrage.net/browse/GD-1355) Prevent ad reload debug logs in production

## 3.6.5

[GD-1355](https://jira.gutefrage.net/browse/GD-1355) Fix requestAdsCalls counter

## 3.6.4

[GD-1355](https://jira.gutefrage.net/browse/GD-1355) Fix ugly logging

## 3.6.3

[GD-1355](https://jira.gutefrage.net/browse/GD-1355) Don't log slot visibility if slot isn't monitored

## 3.6.2

[GD-1355](https://jira.gutefrage.net/browse/GD-1355) Add logging on why a slot can't be monitored by ad reload

## 3.6.1

[GD-1355](https://jira.gutefrage.net/browse/GD-1355) Add order id exclude list to native ad reload module

## 3.6.0

[GD-1355](https://jira.gutefrage.net/browse/GD-1355) Add native moli ad reload module

## 3.5.4

[HPO-116](https://jira.gutefrage.net/browse/HPO-116). Mark `targetingUUID` for unruly as optional and deprecated.

## 3.5.3

[GD-2364](https://jira.gutefrage.net/browse/GD-2364). Add `injTagId` parameter for ScreenOnDemand (DSPX).

## 3.5.2

[GD-2354](https://jira.gutefrage.net/browse/GD-2354). Fix critical bug where ad slots could not have been rendered, because
the DOM is not ready yet.

## 3.5.1

Add `outstreamAU` parameter to pubmatic bid configuration.

## 3.5.0

[GD-2333](https://jira.gutefrage.net/browse/GD-2333) Move enableCpmComparison flag to SkinConfig (from SkinModuleConfig).
Destroy skin slot via `window.googletag` if skin cpm is lower than the combined cpms of to-be-removed slots.

## 3.4.1

[GD-2333](https://jira.gutefrage.net/browse/GD-2333) IE11 compatibility (not using Array.includes), filtering undefined
bid objects

## 3.4.0

[GD-2333](https://jira.gutefrage.net/browse/GD-2333) Compare skin cpm to combined cpms of to-be-removed slots,
add optional logging for it, and optionally prevent skin delivery

## 3.3.1

[GD-2283](https://jira.gutefrage.net/browse/GD-2283) Don't loose pubstack configuration while filtering prebid

## 3.3.0

## 3.2.4

[GD-2259](https://jira.gutefrage.net/browse/GD-2259) Add pubstack.io types to prebid types

## 3.2.3

[GD-2044] (https://jira.gutefrage.net/browse/GD-2044) Add `basicAds` and `measurement` as allowed purpose values.

## 3.2.2

[GD-2226](https://jira.gutefrage.net/browse/GD-2226). Add configuration option to allow ad pipeline rejection if no purpose one consent is given

## 3.2.0

[GD-2216](https://jira.gutefrage.net/browse/GD-2216) Make ad slot metrics independent from awaitAllSlotsRendered.

## 3.1.0

[GD-2153](https://jira.gutefrage.net/browse/GD-2153) Add try-catch for non-personalized ads step

## 3.0.3

Fix id5 userSync module name.

## 3.0.2

Add `auctionDelay` parameter in [the userSync config](http://prebid.org/dev-docs/publisher-api-reference.html#setConfig-Configure-User-Syncing).
Add `pb` parameter for id5.

## 3.0.1

Add debug message in Sourcepoint CMP module for `setNonPersonalizedAds()`

## 3.0.0

[GD-2083](https://jira.gutefrage.net/browse/GD-2083). Remove all TCF 1 related code.

This is a major breaking change as liveramp / faktor.io is removed, the moli debugger works differently, the
CMP Module is gone and the `consent` configuration scope as well.

## 2.6.5

Set prebid config

## 2.6.3

[GD-1686](https://jira.gutefrage.net/browse/GD-1686). Remove sourcepoint config completely and use vanilla tcfapi

## 2.6.2

[GD-1686](https://jira.gutefrage.net/browse/GD-1686). Don't load sourcepoint script via cmp module

## 2.6.1

[GD-1686](https://jira.gutefrage.net/browse/GD-1686). Add initial draft implementation for sourcepoint cmp module

## 2.6.0

[GD-2139](https://jira.gutefrage.net/browse/GD-2139). Add ability to add multiple prebid adunits per ad slot

## 2.5.0

Rename blacklist to blocklist module.

## 2.4.0

[GD-2121](https://jira.gutefrage.net/browse/GD-2121). `refreshAdSlot` API for the moli ad tag.

This new API method allows publishers to refresh an ad slot programmatically at any point. This feature is specifically
interesting for single page applications where components can load and unload at every point in time.

To use this feature the ad slot requires a loading behaviour `manual`, which means that the slot can only be refreshed
via the `refreshAdSlot` API. Note that there are no safety nets that ensure the slot is not triggered too often.

Depending on the loading state of the ad tag `refreshAdSlot` may do one of two things

1. If `requestAds()` has already been called then `refreshAdSlot` will immediately run a new ad pipeline, which causes
   the ad slot to be loaded
2. If `requestAds()` hasn't been called yet then the ad slot will be queued and requested along with all other ad slots
   when `requestAds()` has been invoked

Note that option 2 is the one that requires less requests. There are multiple ways to optimize for this behaviour.
Either wait until the components have been mounted, delay the `requestAds` call by some amount of milliseconds or even
wait for some user interaction.

## 2.3.3

[GD-2119](https://jira.gutefrage.net/browse/GD-2119). `gpt-destroy-ad-slots` and `gpt-reset-targeting` are called only once per requestAds cycle
This is only relevant for single page applications.

[GD-2119](https://jira.gutefrage.net/browse/GD-2119). Fix slot service remove slots method.


## 2.3.0

[GD-2081](https://jira.gutefrage.net/browse/GD-2081). Send labels as key value

## 2.2.0

[GD-2045](https://jira.gutefrage.net/browse/GD-2045). Add liveramp TCF 2 module
[GD-2044](https://jira.gutefrage.net/browse/GD-2044). Add gdprEnforcement types to prebid.ts

## 2.1.3

[GD-2029](https://jira.gutefrage.net/browse/GD-2029). Match `matchType` to blacklist module

## 2.1.2

Fix reporting - add cmp load time measurement

## 2.1.1

Fix reporting.

## 2.1.0

[GD-2027](https://jira.gutefrage.net/browse/GD-2027). Add `Blacklist URLs` module to send key-values or block the
ad pipeline for blacklisted url patterns.

## 2.0.1

[GD-1738](https://jira.gutefrage.net/browse/GD-1738). Support `adUnitPath` in passback messages.

## 2.0.0

Rework of the internal ad processing. The `DfpService` is called `AdService` and constructs an `AdPipeline`, which
can be called on a set of ad slots. The `AdPipeline` is responsible for initializing, configuring and requesting ads.

## 1.43.0

[GD-2002](https://jira.gutefrage.net/browse/GD-2002). Add rubicon types.

## 1.42.0

[GD-1978](https://jira.gutefrage.net/browse/GD-1978). Add user id module types.
[GD-1947](https://jira.gutefrage.net/browse/GD-1947). Enable prebid native support.

## 1.41.0

[GD-1934](https://jira.gutefrage.net/browse/GD-1934). Extend faktor cmp module to fetch `faktor.js`. Either lazy or eager.

Example

```javascript
import Faktor from '@highfivve/module-cmp-faktor';

moli.registerModule(new Faktor({
  autoOptIn: true,
  site: {
    mode: 'lazy',
    url: 'https://config-prod.choice.faktor.io/cb5df6d3-99b4-4d5b-8237-2ff9fa97d1a0/faktor.js'
  }
}, window));
```

## 1.40.4

[GD-1908](https://jira.gutefrage.net/browse/GD-1908). Allow multiple calls to `enableSinglePageApp` if ad tag is already in `spa` mode

## 1.40.3

[GD-1830](https://jira.gutefrage.net/browse/GD-1830). Add retry for yield optimization fetching

## 1.40.0

[GD-1824](https://jira.gutefrage.net/browse/GD-1824). Add standard `consent` key value to dfp service for nonPersonalizedAds tracking (full, none).
[GD-1816](https://jira.gutefrage.net/browse/GD-1816). Make generic-skin module configurable for just premium mobile format

## 1.38.1

Added `currency` parameter to pubmatic.

## 1.38.0

[GD-1791](https://jira.gutefrage.net/browse/GD-1791). Add generic-skin module
[GD-1794](https://jira.gutefrage.net/browse/GD-1794). Add floorprice params for prebid partners
[GD-1798](https://jira.gutefrage.net/browse/GD-1794). Provide cpm in PrebidAdSlot context

## 1.37.1

[GD-1189](https://jira.gutefrage.net/browse/GD-1189). Add DSPX (Screen on Demand) Header Bidding types

## 1.36.0

[GD-1739](https://jira.gutefrage.net/browse/GD-1739). Add Xaxis Header Bidding types

## 1.35.0

[GD-1667](https://jira.gutefrage.net/browse/GD-1667). Changed the yield optimization config structure.

## 1.34.0

[GD-1731](https://jira.gutefrage.net/browse/GD-1731). The `autoOptIn` behaviour for the faktor.io CMP module change.


### Auto Opt In: `true`

1. if the user has no consent data (opt-in/out) then
   1. call `acceptAll`, which performs an full opt-in. Then
   2. call `showConsentManager`, which will display the consent manager. This will not block ad loading!
2. if the user has consent data present do nothing

This behaviour allows us to perform fully personalized ads on the first user impression, while giving the user the
opportunity to opt-out for the future.

After the first impression no consent dialog will be displayed as the auto-opt-in was performed.

### Auto Opt In: `false`

No changes.

## 1.32.0

Add [static cmp module](modules/static-cmp) which always returns the static configured values.
This is **not** iab compliant and will thus configure no stubs or return any consent values.

## 1.31.0

Add [generic cmp module](modules/generic-cmp) which is not tied to faktor.io.

## 1.30.0

[GD-1667](https://jira.gutefrage.net/browse/GD-1667) Configure yield optimization. All configurations now require
a new property `yieldOptimization`.

```javascript
yieldOptimization: {
   provider: 'none'
}
```

The simplest configuration is using provider `none`. This means no yield optimization is performed.
For testing we should use the `static` provider with a static configuration inlined in the ad tag.
The `dynamic` provider is used for production.

```javascript
yieldOptimization: {
   provider: 'dynamic',
   configEndpoint: '//yield.h5v.eu/the-publisher-name.json'
}
```

Note that you can create a local config json file as well and point to localhost or something else for development.

## 1.29.3

[GD-1613](https://jira.gutefrage.net/browse/GD-1613) Allow passbacks to trigger at most once.

## 1.29.2

BUGFIX: clearTargeting must not be called before refreshing as this removes all the prebid key values.

## 1.29.1 - DO NOT USE

[GD-1613](https://jira.gutefrage.net/browse/GD-1613) BUGFIX: initialize passback service after gpt has been loaded


[GD-1619](https://jira.gutefrage.net/browse/GD-1619) Add timeout for cmp operations.

Configure a timeout in ms for operations on the cmp module. If not configures all operations will block
until they have finished. The default is none meaning operations block until finished.

## 1.29.0 - DO NOT USE

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
var passbackCallback = function() {
    var request = JSON.stringify({
      type: 'passback',
      domId: 'content-2',
      passbackOrigin: '<advertiser name>'
    });
    try {
      // first try to post a message on the top most window
      window.top.postMessage(request, '*');
    } catch (_) {
      // best-effort postMessage
      window.postMessage(request, '*');
    }
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
import { initAdTag } from '@highfivve/ad-tag/lib/ads/moliGlobal';
import { adConfiguration } from "./configuration";

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
import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';

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
