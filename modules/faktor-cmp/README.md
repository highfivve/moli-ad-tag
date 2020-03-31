# Liveramp (former faktor.io) [liveramp.com](https://liveramp.com/our-platform/preference-consent-management/)

Faktor provides an IAB compliant CMP.

## Consent Dialog

Depending on the auto opt in setting there are two alternatives.

### Auto Opt In: `true`

1. if the user has no consent data (opt-in/out) then
   1. call `acceptAll`, which performs an full opt-in. Then
   2. call `showConsentManager`, which will display the consent manager. This will not block ad loading!
2. if the user has consent data present do nothing

This behaviour allows us to perform fully personalized ads on the first user impression, while giving the user the
opportunity to opt-out for the future.

After the first impression no consent dialog will be displayed as the auto-opt-in was performed.

### Auto Opt In: `false`

The faktor.io tag needs to be configured so that the UI will be shown. Depending on the configuration this may block
or not block ad loading.

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

### Fetch faktor.js

The module is also capable of fetching the `faktor.js` itself without any additional script integration by the
publisher.

```js
import Faktor from '@highfivve/module-cmp-faktor';

moli.registerModule(new Faktor({
  autoOptIn: true,
  site: {
    mode: 'lazy',
    url: 'https://config-prod.choice.faktor.io/cb5df6d3-99b4-4d5b-8237-2ff9fa97d1a0/faktor.js'
  }
}, window));
```

The `mode` controls when the javascript is being fetched. 

- `eager`: javascript is fetched during the module `init` phase
- `lazy` : javascript is fetched on the first API call


## Resources

- [Faktor Portal](https://portal.choice.faktor.io/)
- [Faktor Service Desk](https://faktor.atlassian.net/servicedesk/customer/portals)