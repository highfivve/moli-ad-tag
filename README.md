
# Building a publisher ad tag

Add at least the `ad-tag` as a dependency.

```bash
$ yarn add @highfivve/ad-tag
```

## moli release script

Moli provides a release script that helps you build releases and a summary page.
Add the binary with:

```bash
$ yarn add @highfivve/moli-release
```

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

You require `yarn` for developing.

```bash
$ yarn setup
```

If you have already checkout this repository you may want to clean things before:

```bash
$ yarn clean && yarn setup
```


# Examples

In order to run the examples you need to build the ad tag and all modules first.

```bash
$ yarn workspaces run make:nodemodule
```

## Testing with examples

If you want to test code changes within the examples you have to perform the current steps
in order for changes to appear.

```bash
# rebuild the module you change, e.g. ad-tag
$ yarn workspace @highfivve/ad-tag make:nodemodule

# restart the example ad tag, e.g. the example-publisher-mode
$ yarn workspace @highfivve/example-publisher-mode start
```

# TODOs for Open Source migration

- The examples currently depend on the ad-tag through yarn workspaces.
  This is the ideal way to work with an ad tag and to develop some features or reproduce bugs.
  Hopefully we can keep it that way.
- The examples are listed as yarn workspaces, but not configured in the the [lerna.json](lerna.json).
  Ideally this prevents these packages from being published as NPM modules
- Build a github release with lerna (see `--create-release` flag in the `lerna version` command)

# Release

Releases are automatically prepared and publish via github actions. To trigger a release run

```bash
yarn lerna version
```

There will always be a release draft on the [github release page](https://github.com/highfivve/moli-ad-tag/releases).
Pick the version the release drafter suggests.
