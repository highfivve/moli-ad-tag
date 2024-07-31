# Ad Tag Library

This library provides a set of components to orchestrate Google Ad Manager (GAM), Prebid and Amazon TAM.

## Building a bundle

An ad tag bundle is a set of modules bundled together in a single javascript file. This file can be included in a website to display ads.
In order to create a bundle you need

1. A JSON configuration file that contains the modules that should be included. All modules are in [ad-tag/source/ts/bundle](ad-tag/source/ts/bundle).
   You can find examples bundles in [bundles](bundles).
2. This repository cloned and installed at the version you want to build.

Then run

```bash
npm ci
npx ts-node bundle.ts --output adtag.mjs --config <path-to-config.json>
```

This will generate an ES6 bundle.

!! If you are using node.js 17+ you currently need to do this !!

```bash
export NODE_OPTIONS=--openssl-legacy-provider
```

See [https://stackoverflow.com/questions/69692842/error-message-error0308010cdigital-envelope-routinesunsupported](https://stackoverflow.com/questions/69692842/error-message-error0308010cdigital-envelope-routinesunsupported)

### Authentication
[See github docs on authentication](https://docs.github.com/en/free-pro-team@latest/packages/using-github-packages-with-your-projects-ecosystem/configuring-npm-for-use-with-github-packages)

Add the .npmrc file to publisher project, so that we can install the package from the github npm registry.
As long as we have a private github repository we need to add the authToken (currently personal token).

```
@highfivve:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken={TOKEN}
always-auth=true
registry=https://registry.npmjs.org
```

I recommend putting this under `~/.npmrc` as described in the [npmrc documentation](https://docs.npmjs.com/cli/v6/configuring-npm/npmrc)

# Developing

You require `npm` for developing.

```bash
npm run setup
```

## Running tests

You can run tests with

```bash
npm test
```

If you do run tests in your IDE, you need to make sure that those two parameters are added to the Mocha runner

```
--require ts-node/register --require tsconfig-paths/register
```

The [tsconfig-paths](https://www.npmjs.com/package/tsconfig-paths) package is necessary to support the `compilerOptions.paths` in the `tsconfig.json`,
which allow for more concise imports.

For intellij see [https://www.jetbrains.com/help/idea/running-unit-tests-on-typescript.html#mocha](https://www.jetbrains.com/help/idea/running-unit-tests-on-typescript.html#mocha)

## Examples

In order to run the examples you must create a production build of the modules.

```bash
npm run build:watch
```

### Testing with examples

If you want to test code changes within the examples you have to start the module in watch mode.

```bash
# rebuild the module you change, e.g. ad-tag
cd examples/esbuild
npm start
```

## Console

You can build and test the console locally with

```bash
npm run build:console:watch
```

Then you can start the esbuild example with

```bash
cd examples/esbuild
npm start
```

Open your browser at localhost:8080 , open your javascript console and run

```javascript
moli.openConsole('console.js');
```

# Release

Releases are automatically prepared and publish via github actions. To trigger a release run

```bash
npm run release
```

There will always be a release draft on the [github release page](https://github.com/highfivve/moli-ad-tag/releases).
Pick the version the release drafter suggests.
