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
- Single Page Application mode

## Example projects

The example projects can be used to test some features locally and to show case different integrations.
All projects reference top-level moli build via `yarn link`. You can start a local project by

1. Go to the desired sub folder, e.g. [examples/instant](examples/instant)
2. Run `yarn install && yarn start`
3. Open your browser [https://localhost:9000](https://localhost:9000)

`webpack-dev-server` is [configured with https](https://webpack.js.org/configuration/dev-server/#devserver-https) to ensure
we have a more production like setup. The certificate is self-signed.

**Known issues**

- Intellij needs some help to realize moli has updated

## Release

As every publisher tag references moli as a source dependency releases are only for easier communication.
You can always rely on a git commit sha for hot fixes, etc.

When to make a release

1. New feature implemented
2. New prebid types

### Create a release

We rely on the [npm version](https://docs.npmjs.com/cli/version.html) cli.

```bash
$ npm version [<newversion> | major | minor | patch | premajor | preminor | prepatch
```

Done.