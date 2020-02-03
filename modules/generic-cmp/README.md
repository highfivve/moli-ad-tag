# Generic IAB CMP module

Provides a generic CMP module that provides readiness checking and a cmp stub.

## Integration

In your `index.ts` import confiant and register the module.

```js
import Cmp from '@highfivve/modules/generic-cmp';
moli.registerModule(new Cmp(window));
```

The publisher needs to integrate the CMP by themselves. For testing we can use Faktor.io