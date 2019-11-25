# Confiant [www.confiant.com/](https://www.confiant.com/)

Confiant is an ad fraud detection and blocking solution. It supports gpt and prebid.

## Integration

In your `index.ts` import confiant and register the module.

```js
import Confiant from '@highfivve/modules/confiant';
moli.registerModule(new Confiant({
  assertUrl: 'https://confiant-integrations.global.ssl.fastly.net/yqnNhQYNEfv8ldKXnwevFDx_IRM/gpt_and_prebid/config.js'
}, window));
```

### Alternative integration

A publisher can also decided to integrated it directly in the head with

```html
<head>
    <script async src="https://confiant-integrations.global.ssl.fastly.net/yqnNhQYNEfv8ldKXnwevFDx_IRM/gpt_and_prebid/config.js"></script>
</head>
```

## Resources

- [Confiant Dashboard](https://app.confiant.com/)
- [Confluence Page](https://confluence.gutefrage.net/display/DEV/Confiant)
