# Blacklist URLs

This module adds `configureStep` or `prepareRequestAds` steps to the ad pipeline in order to prevent ad requests entirely
or a set a configurable key-value, which can be used in the ad server to handle blacklisted urls

## Integration

In your `index.ts` import the blacklist-urls module and register it.

The configuration has multiple parameters

- `mode` - this describes what the module does if a blacklisted url is detected
  - `key-value` - sets a specific key-value on the googletag
  - `block` - rejects the pipeline step which leads to no ads being loaded
- `blacklist` - this config object contains the blacklist configuration
  - `provider` - select how the blacklist is being loaded
    - `static` - inline configuration inside the ad tag
    - `dynamic` - loads an external json file


### Blacklist format

A blacklist contains a list of blacklist entries stored in the `urls` property. A `IBlacklistEntry` has two
properties.

- `pattern` - a string that is evaluated depending on the `matchType`
- `matchType`
  - `exact` - the url must match the pattern string
  - `contains` - the url must contain the given pattern string
  - `regex` - the url tests positive against the pattern regex string

### Examples


```javascript
import BlacklistedUrls from '@highfivve/modules/blacklist-urls';

moli.registerModule(new BlacklistedUrls({
  mode: 'block',
  blacklist: {
    provider: 'static',
    blacklist: {
      urls: [
        // a specific path
        { pattern: '\/path\/that\/should\/be\/blacklisted', matchType: 'regex' },
        // all http sites
        { pattern: '^http:\/\/.*', matchType: 'regex' },
        // contains a bad word
        { pattern: '/tag/badword', matchType: 'contains' },
        // exact url
        { pattern: 'https://www.example.com/login', matchType: 'exact' }
      ]
    }
  }
}, window));
```

You can combine `block` and `key-value` mode by adding the module twice.

```javascript
import BlacklistedUrls from '@highfivve/modules/blacklist-urls';

moli.registerModule(new BlacklistedUrls({
  mode: 'block',
  blacklist: {
    provider: 'static',
    blacklist: {
      urls: [
        { pattern: '\/login$' },
        { pattern: '\/register$' },
      ]
    }
  }
}, window));

moli.registerModule(new BlacklistedUrls({
  mode: 'key-value',
  blacklist: {
    provider: 'static',
    blacklist: {
      urls: [
        // a specific path
        { pattern: '\/path\/that\/should\/be\/blacklisted' },
        // all http sites
        { pattern: '^http:\/\/.*' }
      ]
    }
  }
}, window));
```