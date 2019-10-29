# Sovrn [www.sovrn.com/](https://www.sovrn.com/)

Sovrn provides an Ad Reload solution to optimize long lived user sessions by reload
specific ad slots.

## Integration

In your `index.ts` import confiant and register the module.

```js
import SovrnAdReload from '@highfivve/modules/svorn-ad-reload';
moli.registerModule(new SovrnAdReload({
    assetUrl: '//get.s-onetag.com/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/tag.min.js'
}));
```

The property id (`xxx-xxxx....`) is part of an "Ad Tag". We create one for each publisher.

## Resources

- [Sovrn Ad Tag](https://meridian.sovrn.com/#adtags/connect_tags)
- [Confluence Page](https://confluence.gutefrage.net/display/DEV/Sovrn)
