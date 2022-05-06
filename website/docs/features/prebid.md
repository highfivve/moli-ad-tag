---
title: Prebid
---

The moli ad tag library natively integrates with [prebid.js](https://docs.prebid.org/prebid/prebidjs.html).

## Enable prebid

You enable prebid by setting a [PrebidConfig](../api/interfaces/Moli.headerbidding.PrebidConfig) in your
ad tag [MoliConfig](../api/interfaces/Moli.MoliConfig). The library will take of setting the configuration
for prebid.

### Configuration properties

The `prebid` config object contains configurations from pbjs and moli itself.

- `bidderSettings` - set the [`pbjs.bidderSettings`](https://docs.prebid.org/dev-docs/publisher-api-reference/bidderSettings.html)
- `config` - will be set via [`pbjs.setConfig()`](https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html)

See a full list of properties in the [PrebidConfig API doc](../api/interfaces/Moli.headerbidding.PrebidConfig)

### Example

This is a small config with some parameters configured

```js
{
  slots: [ /* ... */],
  prebid: {
    // the full prebid config which is set via pbjs.setConfig()
    config: {
      bidderTimeout: 1000,
      consentManagement: {
        timeout: 500,
        allowAuctionWithoutConsent: true
      },
      floors: {
        enforcement: {
          enforceJS: false
        }
      },
      userSync: {
        userIds: [ ]
      },
      currency: {
        adServerCurrency: 'EUR'
      }
    }
  }
}
```

## Sizes & Labels

The ad tag filters the sizes provider in `mediaType.banner.sizes` and `mediaType.video.playerSize` based on
the given `sizeConfigs`.

Labels can be used in a `bid` object like in prebid to filter a bid based on available labels

## Consent behaviour

Prebid won't be called before the consent state is ready. The `cmpTimeout` setting has no effect.

## Ad Slot

You enable prebid for a single ad slot by setting the [`prebid`](.../api/interfaces/Moli.AdSlot#prebid) property.
The value is a [`PrebidAdSlotConfigProvider`](../api/namespaces/Moli.headerbidding#prebidadslotconfigprovider), which can be
either a static value or function that allows more dynamic behaviour.

The [`PrebidAdSlotConfigProvider`](../api/namespaces/Moli.headerbidding#prebidadslotconfigprovider) returns a single or an array
of [`PrebidAdSlotConfig` objects](../api/interfaces/Moli.headerbidding.PrebidAdSlotConfig). They provide an [prebidjs.IAdUnit](../api/interfaces/prebidjs.IAdUnit)
that hosts a standard [prebidjs ad unit](https://docs.prebid.org/dev-docs/adunit-reference.html).

### Example: single ad unit

This is a standard ad slot with a single prebid bid object

```js
{
  position: 'in-page',
  domId: 'content_1',
  behaviour: { loaded: 'eager' },
  adUnitPath: '/123,456/content_1',
  sizes: [[300, 250], [728, 90], 'fluid'],
  // highlight-start
  prebid: {
    adUnit: {
      mediaTypes: {
        banner: {
          sizes: [[300,250], [728, 90]]
        }
      },
      bids: [
        { bidder: 'criteo' , params: { networkId: 123, publisherSubId: 'content_1' }}
      ]
    }
  },
  // highlight-end
  sizeConfig: [
    {
      mediaQuery: '(man-width: 767px)',
      sizesSupported: [[300, 250], 'fluid']
    },
    {
      mediaQuery: '(min-width: 768px)',
      sizesSupported: [[728,90], 'fluid']
    }
  ]
}
```

### Example: Twin ad units

[Twin ad units](https://docs.prebid.org/dev-docs/adunit-reference.html#twin-adunit-codes) are supported.
The `prebid` property may return an array of ad units.

```js
{
  position: 'in-page',
  domId: 'content_1',
  behaviour: { loaded: 'eager' },
  adUnitPath: '/123,456/content_1',
  sizes: [[300, 250], [728, 90], 'fluid'],
  // highlight-start
  prebid: [
    {
      adUnit: {
        mediaTypes: {
          banner: { sizes: [[300,250], [728, 90]]}
        },
        bids: [{ bidder: 'criteo' , params: { networkId: 123, publisherSubId: 'content_1' }}]
      }
    },
    {
      adUnit: {
        mediaTypes: {
          video: { /* video settings */}
        },
        bids: [{ bidder: 'video-bidder' , params: { placementId: 'content_1' }}]
      }
    }
  ],
  // highlight-end
  sizeConfig: [
    {
      mediaQuery: '(man-width: 767px)',
      sizesSupported: [[300, 250], 'fluid']
    },
    {
      mediaQuery: '(min-width: 768px)',
      sizesSupported: [[728,90], 'fluid']
    }
  ]
}
```

### Example: Dynamic ad unit

Sometimes you want to do something before creating prebid ad unit objects.
The receives a [`PrebidAdSlotContext`](../api/interfaces/Moli.headerbidding.PrebidAdSlotContext), which grants access
to ad slot specific properties.

```js
{
  position: 'in-page',
  domId: 'content_1',
  behaviour: { loaded: 'eager' },
  adUnitPath: '/123,456/content_1',
  sizes: [[300, 250], [728, 90], 'fluid'],
  // highlight-start
  prebid: context => ({
  // highlight-end
    adUnit: {
      mediaTypes: {
        banner: {
          sizes: [[300,250], [728, 90]]
        }
      },
      bids: [
        { 
          bidder: 'appNexus' ,
          params: { 
            placmenentId: 123, 
            // highlight-start
            keywords: { iab1: context.keyValues.iab1 ?? 'none'} 
            // highlight-end
          }
        }
      ]
    }
  }),
  sizeConfig: [
    {
      mediaQuery: '(man-width: 767px)',
      sizesSupported: [[300, 250], 'fluid']
    },
    {
      mediaQuery: '(min-width: 768px)',
      sizesSupported: [[728,90], 'fluid']
    }
  ]
}
