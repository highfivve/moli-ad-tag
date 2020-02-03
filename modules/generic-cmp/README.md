# Liveramp (former faktor.io) [liveramp.com](https://liveramp.com/our-platform/preference-consent-management/)

Faktor provides an IAB compliant CMP.

## Integration

In your `index.ts` import confiant and register the module.

```js
import Faktor from '@highfivve/modules/faktor-cmp';
moli.registerModule(new Faktor({
  autoOptIn: false
}, window));
```

On the publisher page a factor script tag must be added. Example:

```html
<script async src="https://config-prod.choice.faktor.io/cb5df6d3-99b4-4d5b-8237-2ff9fa97d1a0/faktor.js"></script>
```


## Resources

- [Faktor Portal](https://portal.choice.faktor.io/)
- [Faktor Service Desk](https://faktor.atlassian.net/servicedesk/customer/portals)