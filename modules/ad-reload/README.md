# Moli Ad Reload

Moli's own Ad Reload solution to optimize long lived user sessions by reloading
specific ad slots.

## Integration

In your `index.ts`, import AdReload and register the module.

```js
import AdReload from '@highfivve/modules/ad-reload';

moli.registerModule(
  new AdReload({
    excludeAdSlotDomIds: [ ... ],
    includeAdvertiserIds: [ ... ],
    includeOrderIds: [ ... ],
    excludeOrderIds: [ ... ],
    refreshIntervalMs: 20000,
    userActivityLevelControl: { level: 'moderate' }
  })
);
```

Configure the module with:

* the DOM IDs you want to **exclude** from being reloaded
* the order ids ("campaign ids" in Google's terminology) you want to **include** for reloading
* the advertiser ids ("company ids" in Google's terminology) you want to **include** for reloading
* the order ids ("campaign ids" in Google's terminology) you want to **exclude** for reloading; this option
  **overrides the includes**!
* **[optional]** the refresh interval that the reload module should wait before reloading a slot. The interval
  specifies the minimum time in which the ad has to be visible before refreshing it.
* **[optional]** the strictness of checking user activity. The strictness levels are defined like this:
  * strict:
    * userActivityDuration: 10 seconds
    * userBecomingInactiveDuration: 5 seconds
  * moderate:
    * userActivityDuration: 12 seconds
    * userBecomingInactiveDuration: 8 seconds
  * lax:
    * userActivityDuration: 15 seconds
    * userBecomingInactiveDuration: 12 seconds
  * custom:
    * userActivityDuration: configurable
    * userBecomingInactiveDuration: configurable
