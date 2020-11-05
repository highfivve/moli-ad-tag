# LiveRamp IdentityLink module ([-> Docs](https://docs.authenticated-traffic-solution.com/docs))

This module provides LiveRamp ATS (authenticated traffic solution) functionality to moli. Basically,
this means that users are identified cross-platform using a hash of their email address.

## Integration

In your `index.ts`, import IdentityLink and register the module.

```js
import IdentityLink from '@highfivve/modules/identitylink';

moli.registerModule(
  new IdentityLink({
    assetUrl: '//ats.rlcdn.com/ats.js',
    placementId: 1337,
    hashedEmailAddresses: ['[MD5 hash]', '[SHA-1 hash]', '[SHA-256 hash]']
  })
);
```

Configure the module with:

- the `ats.js` URL (can be protocol relative)
- your LiveRamp placement id
- pre-hashed versions of the user's email address (MD5, SHA-1, and SHA-256 format)
