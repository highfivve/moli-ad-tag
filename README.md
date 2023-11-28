
# Building a publisher ad tag

Add at least the `ad-tag` as a dependency.

```bash
$ yarn add @highfivve/ad-tag
```

!! If you are using node.js 17+ you currently need to do this !!

```bash
export NODE_OPTIONS=--openssl-legacy-provider
```

See <https://stackoverflow.com/questions/69692842/error-message-error0308010cdigital-envelope-routinesunsupported>

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
yarn setup
```

If you have already checkout this repository you may want to clean things before:

```bash
yarn clean && yarn setup
```

This will build all required modules as *CommonJS* modules! That allows you to run all the tests,
but **not** the examples!


## Examples

In order to run the examples you must create a production build of the modules.

```bash
# the clean step is important to remove any commonjs module that were setup with "yarn setup"
yarn clean:lib && yarn workspaces run make:nodemodule
```

### Testing with examples

If you want to test code changes within the examples you have to start the module in watch mode.

```bash
# rebuild the module you change, e.g. ad-tag
yarn workspace @highfivve/ad-tag make:nodemodule --watch
```

Note that the workspace _name_ for an example can be found in the respective project folder within the `package.json`.

And then start one of the example projects

```bash
yarn workspace @highfivve/example-publisher-mode start
```

If you are developing a module, don't forget to start the module build in watch mode as well

```bash
# rebuild the module you change
yarn workspace @highfivve/module-my-new-awesome-module make:nodemodule --watch
```

# Release

Releases are automatically prepared and publish via github actions. To trigger a release run

```bash
yarn lerna version --exact
```

There will always be a release draft on the [github release page](https://github.com/highfivve/moli-ad-tag/releases).
Pick the version the release drafter suggests.

After the version is bumped, push everything to the github repo. Assuming your `remote` is called `github`

```bash
git push github master --tags
```
