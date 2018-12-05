# IE 11 compatible

This example show cases how a a IE11 compatible build looks like

Features:

- prebid build
- regular dfp slots

Start a local webserver with

```bash
$ yarn && yarn start
```

See the [index.ts](index.ts) entrypoint for more implementation details

## yarn link

[yarn link](https://yarnpkg.com/lang/en/docs/cli/link/) doesn't seem to work for the `moli-ad-tag` side-by-side development.

1. Checkout the `moli-ad-tag` repository (you already did)
2. Run `yarn install`
3. In this folder run `yarn install`, which will automatically link

Now you have linked the checked out repository with this one.
 
!! DON'T FORGET TO UNLINK AFTER YOU ARE FINISHED !!

1. In the `moli-ad-tag` repository run `yarn unlink`
2. In this repository run `yarn unlink moli-ad-tag`


You cannot import from `moli-ad-tag` directly, but have to use the full source path.
Otherwise tyepscript yields this error:

```
ERROR in ../moli-ad-tag/source/ts/index.ts
Module build failed (from ./node_modules/ts-loader/index.js):
Error: TypeScript emitted no output for /home/muki/dev/git/sales/moli-ad-tag/source/ts/index.ts.
    at makeSourceMapAndFinish (/home/muki/dev/git/sales/publisher-tags/node_modules/ts-loader/dist/index.js:78:15)
    at successLoader (/home/muki/dev/git/sales/publisher-tags/node_modules/ts-loader/dist/index.js:68:9)
    at Object.loader (/home/muki/dev/git/sales/publisher-tags/node_modules/ts-loader/dist/index.js:22:12)
 @ ./index.ts 4:22-44
```