# Generic CMP TCF 2.0

TCF 2.0 integration with liveramp GDPR Module.

## Integration

In the publisher ad tag add

```js
import Cmp from '@highfivve/module-cmp-liveramp-tcf2';

moli.registerModule(new Cmp(window));
```

Depending on other integrations and / or how google integrates with the IAB framework the publisher
may need to place the cmp stub in the `head` tag. 

The recommended way is to inline the javascript downloaded from https://gdpr.privacymanager.io/1/stub.bundle.js

As an alternative the script can be placed in a blocking script tag like this:

```html
<head>
  <script src="https://gdpr.privacymanager.io/1/stub.bundle.js"></script>
</head>
```
