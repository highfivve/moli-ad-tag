# Confiant [www.confiant.com/](https://www.confiant.com/)

Confiant is an ad fraud detection and blocking solution. It supports gpt and prebid.

## Integration

In your `index.ts` import confiant and register the module.

```js
import Confiant from '@highfivve/modules/confiant';
moli.registerModule(new Confiant({
  gpt: {
    propertyId: '???',
    confiantCdn: 'clarium.global.ssl.fastly.net',
    sandbox: 0,
    mapping: 'W3siaSI6MiwidCI6Int7b319Ont7d319eHt7aH19IiwicCI6MCwiRCI6MSwiciI6W119LHsiaSI6NiwidCI6Int7Y299fTp7e3d9fXh7e2h9fSIsInAiOjUwLCJEIjowLCJyIjpbeyJ0IjoiZXgiLCJzIjpudWxsLCJ2IjoiY28ifV19XQ==',
    activation: '???',
    // callback is required - by default we set it to noop
    callback: () => { return; }
  }
}));
```

## Resources

- [Confiant Dashboard](https://app.confiant.com/)
- [Confluence Page](https://confluence.gutefrage.net/display/DEV/Confiant)
