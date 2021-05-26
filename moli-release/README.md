# Moli Release

CLI tool helping to streamline ad tag releases.

## Requirements

Your ad tag build should have the following npm dependencies installed

- `webpack-manifest-plugin`
- `handlebars-webpack-plugin`
- `html-webpack-plugin`

Your webpack config should have `moli` as the main entry point for the ad tag:

```js
entry: {
  moli: './index.ts'
}
```

## Releasing ES5 ad tags, too

By default, moli ad tags are now released as ES6 only.

Building ES5 bundles can be enabled by using a second webpack config, though. See the moli examples (publisher mode)
for guidance.

For automated releases of ES5 bundles, the second webpack config should have `moli_es5` as the main entry point:

```js
entry: {
  moli_es5: './index.es5.ts'
}
```
