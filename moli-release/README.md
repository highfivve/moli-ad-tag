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
