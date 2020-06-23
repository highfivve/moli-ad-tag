# Blocklist URLs

This module adds `configureStep` or `prepareRequestAds` steps to the ad pipeline in order to prevent ad requests entirely
or a set a configurable key-value, which can be used in the ad server to handle blocklisted urls

## Integration

In your `index.ts` import the blocklist-urls module and register it.

The configuration has multiple parameters

- `mode` - this describes what the module does if a blocklisted url is detected
  - `key-value` - sets a specific key-value on the googletag
  - `block` - rejects the pipeline step which leads to no ads being loaded
- `blocklist` - this config object contains the blocklist configuration
  - `provider` - select how the blocklist is being loaded
    - `static` - inline configuration inside the ad tag
    - `dynamic` - loads an external json file


### Blocklist format

A blocklist contains a list of blocklist entries stored in the `urls` property. A `IBlocklistEntry` has two
properties.

- `pattern` - a string that is evaluated depending on the `matchType`
- `matchType`
  - `exact` - the url must match the pattern string
  - `contains` - the url must contain the given pattern string
  - `regex` - the url tests positive against the pattern regex string

### Examples


```javascript
import BlocklistedUrls from '@highfivve/modules/blocklist-urls';

moli.registerModule(new BlocklistedUrls({
  mode: 'block',
  blocklist: {
    provider: 'static',
    blocklist: {
      urls: [
        // a specific path
        { pattern: '\/path\/that\/should\/be\/blocklisted', matchType: 'regex' },
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
import BlocklistedUrls from '@highfivve/modules/blocklist-urls';

moli.registerModule(new BlocklistedUrls({
  mode: 'block',
  blocklist: {
    provider: 'static',
    blocklist: {
      urls: [
        { pattern: '\/login$' },
        { pattern: '\/register$' },
      ]
    }
  }
}, window));

moli.registerModule(new BlocklistedUrls({
  mode: 'key-value',
  blocklist: {
    provider: 'static',
    blocklist: {
      urls: [
        // a specific path
        { pattern: '\/path\/that\/should\/be\/blocklisted' },
        // all http sites
        { pattern: '^http:\/\/.*' }
      ]
    }
  }
}, window));
```