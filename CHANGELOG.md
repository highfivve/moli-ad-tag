# Changelog

## Unreleased

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