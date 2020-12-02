# Zeotap data and identity plus module ([-> Website](https://zeotap.com))

This module provides Zeotap's data collection and identity provider functionality to moli.

## Integration

In your `index.ts`, import Zeotap and register the module.

```js
import Zeotap from '@highfivve/modules/zeotap/zeotap';

const zeotap = new Zeotap({
  assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
  countryCode: 'DEU',
  mode: 'default',
  hashedEmailAddress: 'somehashedaddress',
  dataKeyValues: [
    { keyValueKey: 'channel', parameterKey: 'zcat' },
    { keyValueKey: 'subChannel', parameterKey: 'zscat' },
    { keyValueKey: 'tags', parameterKey: 'zcid' }
  ],
  exclusionKeyValues: [
    { keyValueKey: 'channel', disableOnValue: 'MedicalHealth' },
    { keyValueKey: 'subChannel', disableOnValue: 'Pornography' }
  ]
});

moli.registerModule(zeotap);
```

Configure the module with:

- `assetUrl`: the zeotap `mapper.js` URL (can be protocol relative)
- `mode`: the mode you want to run the module in, depending on your site's structure. If you're running a single
  page application (SPA), select `spa` mode. Else, select `default`.
- `dataKeyValues`: Specifies which keys to extract from moli's targeting (key/value pairs) and which key then to use to
  transfer the extracted data in the Zeotap request URL.
- `exclusionKeyValues`: Specifies which key/value pairs should prevent the Zeotap script from being loaded, e.g. to
  prevent data collection in pages with sensitive topics such as medical/health content.
- `countryCode` _(optional)_: your site's Alpha-ISO3 country code. If omitted, Zeotap will guess the country from the
  sender's IP address.
- `hashedEmailAddress` _(optional)_: if you want to use Zeotap's id+ module, configure the module with a sha-256 hashed
  email address.
