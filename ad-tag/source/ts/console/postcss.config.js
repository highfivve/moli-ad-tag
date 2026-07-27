/**
 * PostCSS config for the moli debug console only (see rollup.console.config.mjs).
 * Runs Tailwind for the console UI; the publisher CSS build keeps using the
 * postcss.config.js at the repository root.
 *
 * @type {import('postcss-load-config').Config}
 */
const path = require('path');

/**
 * Tailwind emits font-size/spacing/radius in rem. `rem` always resolves against the
 * document's root <html> element, even inside a shadow root - publisher pages that set
 * a small html font-size (e.g. the common `html { font-size: 62.5% }` px->rem trick)
 * shrink the whole console. Converting to fixed px (1rem = 16px) makes the console's
 * sizing independent of the host page.
 */
const remToPx = (rootValue = 16) => ({
  postcssPlugin: 'rem-to-px',
  Declaration(decl) {
    if (decl.value && decl.value.includes('rem')) {
      decl.value = decl.value.replace(/(-?\d*\.?\d+)rem/g, (_, num) => `${parseFloat(num) * rootValue}px`);
    }
  }
});
remToPx.postcss = true;

const config = {
  plugins: [
    require('postcss-import'),
    require('tailwindcss/nesting')(require('postcss-nested')),
    require('tailwindcss')({ config: path.join(__dirname, 'tailwind.config.ts') }),
    remToPx(),
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
