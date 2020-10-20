# Moli Ad Reload

Moli's own Ad Reload solution to optimize long lived user sessions by reloading
specific ad slots.

## Integration

In your `index.ts` import confiant and register the module.

```js
import AdReload from '@highfivve/modules/ad-reload';

moli.registerModule(
  new AdReload({
    includeAdvertiserIds: [ ... ],
    includeOrderIds: [ ... ],
    excludeAdSlotDomIds: [ ... ]
  })
);
```

Configure the module with:

* the DOM IDs you want to **exclude** from being reloaded
* the order ids ("campaign ids" in Google's terminology) you want to **include** for reloading
* the advertiser ids ("company ids" in Google's terminology) you want to **include** for reloading
