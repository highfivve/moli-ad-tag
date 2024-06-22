/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: [
    require('autoprefixer'),
    require('postcss-nested'),
    require('postcss-custom-properties')({ preserve: false }),
    require('postcss-custom-media')({}),
    require('postcss-extend')({}),
    require('postcss-color-function')({}),
    require('cssnano')({
      zindex: false, // prevents automatic postprocessing of the z-indexes, so we can define them as we like.
      autoprefixer: { add: false, remove: false }
    }),
    require('postcss-reporter')({
      clearReportedMessages: true,
      throwError: false
    })
  ]
};

module.exports = config;
