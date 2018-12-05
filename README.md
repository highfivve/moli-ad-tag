# Moli Ad Tag

Moli contains the "glue code" or business logic to render an `adConfiguration`.

## Features

- Configure DFP
  - general settings
  - key-values
  - ad slots
- Configure prebid
  - general settings
  - ad slots
  - special behaviour (lazy loading, refreshable)
- Configure a9
  - general settings
  - ad slots
- Metrics
  - general (time-to-first-ad, dfp load time)
  - ad slot specific metrics (time to request, render and content loaded)

## Example projects

The example projects can be used to test some features locally and to show case different integrations.
All projects reference top-level moli build. You can start a local project by

1. Go to the desired sub folder, e.g. [examples/instant](examples/instant)
2. Run `yarn install && yarn start`
3. Open your browser [https://localhost:9000](https://localhost:9000)

`webpack-dev-server` is [configured with https](https://webpack.js.org/configuration/dev-server/#devserver-https) to ensure
we have a more production like setup. The certificate is self-signed.

**Known issues**

- You need to run `yarn moli:update` to update moli inside an example project
- `yarn moli:update` slowly fills your yarn cache. Run `yarn moli:cleanCache` to clean up the mess
- Intellij needs some help to realize moli has updated

Maybe try `yarn link`, which comes with other issues :/