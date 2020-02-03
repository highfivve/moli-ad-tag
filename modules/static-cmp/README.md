# Static CMP module

Provides a generic static module that returns the configured values.

> **WARNING**: This is okay for testing, but should not be used in production!

## Integration

In your `index.ts` import the static cmp and register the module.

```js
import Cmp from '@highfivve/modules/static-cmp';
moli.registerModule(new Cmp(
  { nonPersonalizedAds: 0 },
  window
));
```