# Blacklist URLs

This module adds `configureStep` or `prepareRequestAds` steps to the ad pipeline in order to prevent ad requests entirely
or a set a configurable key-value, which can be used in the ad server to handle blacklisted urls

## Integration

In your `index.ts` import the blacklist-urls module and register it.


```javascript
import BlacklistedUrls from '@highfivve/modules/blacklist-urls';

moli.registerModule(new BlacklistedUrls({
  mode: 'block',
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

The `pattern` property in the `urls` list **must** be a valid Regex.

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
        { pattern: '\/register' },
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