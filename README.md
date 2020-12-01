
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

## Using lerna

Using lerna for managing multi-package repository. [Lerna on Github](https://github.com/lerna/lerna)

Add a dependency to a package
```bash
$ yarn lerna add <package>
```

Link local packages together and install remaining package dependencies
```bash
$ yarn lerna bootstrap
```

Run an npm script in each package that contains that script
```bash
$ yarn lerna run <script>
// e.g.
$ yarn lerna run make:nodemodule
```

## Publishing a package

Bump version of packages changed since the last release
```bash
$ yarn lerna version
```

See [version command documentation](https://github.com/lerna/lerna/tree/main/commands/version)

Publish packages in the current project
```bash
$ yarn github:publish
```

# Examples

In order to run the examples you need to build the ad tag and all modules first.

```bash
$ yarn workspaces run make:nodeule
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

- The examples currently depend on the the ad-tag through yarn workspaces.
  This is the ideal way to work with an ad tag and to develope some features or reproduce bugs.
  Hopefully we can keep it that way.
- The examples are listed as yarn workspaces, but not configured in the the [lerna.sjon](lerna.json).
  Ideally this prevents these packages from being published as NPM modules
- Build a github release with lerna (see `--create-release` flag in the `lerna version` command)
