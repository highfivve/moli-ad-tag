/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: [
    require('autoprefixer'),
    require('postcss-import'),
    require('postcss-nested'),
    require('postcss-custom-media')({ preserve: false }),
    require('postcss-custom-properties')({ preserve: true }),
    require('postcss-extend')({}),
    require('postcss-color-function')({}),
    require('cssnano')({
      preset: 'default',
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
