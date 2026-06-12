/**
 * PostCSS config for the moli debug console only (see rollup.console.config.mjs).
 * Runs Tailwind for the console UI; the publisher CSS build keeps using the
 * postcss.config.js at the repository root.
 *
 * @type {import('postcss-load-config').Config}
 */
const path = require('path');

const config = {
  plugins: [
    require('postcss-import'),
    require('tailwindcss/nesting')(require('postcss-nested')),
    require('tailwindcss')({ config: path.join(__dirname, 'tailwind.config.ts') }),
    require('autoprefixer'),
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
