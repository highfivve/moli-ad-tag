# Minimal example

A minimal example for playing around with the ad tag. Start with

```shell
npm start
```

This will start up a dev server at [localhost:8000]. Live reload works for the tag itself and also for the ad tag
library if you start the build with `npm run build:watch`;

## Developing CSS

If you want to develop on the [styles.css](../../ad-tag/source/css/styles.css) then you also need to start the postcss
build in the root of the ad tag library with

```bash
npm run build:watch:css
```
