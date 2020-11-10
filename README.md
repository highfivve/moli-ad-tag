
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

# Developing

## Publish moli packages

Using lerna for managing multi-package repository. [Lerna on Github](https://github.com/lerna/lerna)

Add a dependency to a package
```
lerna add <package>
```

Link local packages together and install remaining package dependencies
```
lerna bootstrap
```

Run an npm script in each package that contains that script
```
lerna run <script>
// e.g.
lerna run tsc
```

Bump version of packages changed since the last release
```
lerna version
```

Publish packages in the current project
```
lerna publish from-package --registry https://npm.pkg.github.com/
```
