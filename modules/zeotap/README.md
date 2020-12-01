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
  idpActive: true,
})

moli.registerModule(zeotap);
```

Configure the module with:

- `assetUrl`: the zeotap `mapper.js` URL (can be protocol relative)
- `countryCode`: your site's Alpha-ISO3 country code
- `mode`: the mode you want to run the module in, depending on your site's structure. If you're running a single page
  application, select `spa` mode. Else, select `default`.
- `hashedEmailAddress`/`idpActive`: optionally, if you want to use Zeotap's id+ module, configure the module with a sha-256 hashed email address and set
  `idpActive` to `true`.

To enable data collection, call the module's `loadScript` function:

```js
zeotap.loadScript('Technology & Computing', 'Robotics', ['hardware', 'roboter']);
```

The first parameter should be your site's IAB Tier 1 channel.
The second parameter should be your site's IAB Tier 2 channel.
The third parameter should be your site's tags or keywords as an array of strings.
