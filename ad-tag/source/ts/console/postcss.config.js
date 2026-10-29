/**
 * PostCSS config for the moli debug console only (see rollup.console.config.mjs).
 * Runs Tailwind CSS 4 (+ daisyUI 5, configured in debug.pcss) for the console UI; the
 * publisher CSS build keeps using the postcss.config.js at the repository root.
 *
 * @type {import('postcss-load-config').Config}
 */

/**
 * Tailwind emits font-size/spacing/radius in rem (mostly via theme variables such as
 * `--spacing: .25rem` that utilities use as `calc(var(--spacing) * 4)`). `rem` always
 * resolves against the document's root <html> element, even inside a shadow root -
 * publisher pages that set a small html font-size (e.g. the common `html { font-size: 62.5% }`
 * px->rem trick) shrink the whole console. Converting every declaration value, including
 * custom properties, to fixed px (1rem = 16px) makes the console's sizing independent of
 * the host page.
 */
const remToPx = (rootValue = 16) => ({
  postcssPlugin: 'rem-to-px',
  Declaration(decl) {
    if (decl.value && decl.value.includes('rem')) {
      decl.value = decl.value.replace(
        /(-?\d*\.?\d+)rem\b/g,
        (_, num) => `${parseFloat(num) * rootValue}px`
      );
    }
  }
});
remToPx.postcss = true;

/**
 * Tailwind 4 (and daisyUI 5) register many internal custom properties (`--tw-shadow`,
 * `--tw-border-style`, ...) via `@property` with an `initial-value`. `@property` rules are
 * ignored inside a shadow root, so these variables would stay unset and declarations like
 * `box-shadow: var(--tw-inset-shadow), ..., var(--tw-shadow)` become invalid.
 *
 * This plugin turns every `@property` initial value into a plain declaration in the lowest
 * cascade layer (`properties`), so utilities still override them.
 */
const shadowDomProperties = () => ({
  postcssPlugin: 'shadow-dom-properties',
  OnceExit(root, { Rule, AtRule }) {
    const inherited = [];
    const notInherited = [];
    root.walkAtRules('property', atRule => {
      let initialValue;
      let syntax = '';
      let inherits = false;
      atRule.walkDecls(decl => {
        if (decl.prop === 'initial-value') {
          initialValue = decl.value;
        } else if (decl.prop === 'syntax') {
          syntax = decl.value;
        } else if (decl.prop === 'inherits') {
          inherits = decl.value.trim() === 'true';
        }
      });
      // the minifier shortens `0px` to `0`, which is invalid in calc(3px + var(--x))
      if (initialValue !== undefined && initialValue.trim() === '0') {
        if (syntax.includes('<length')) {
          initialValue = '0px';
        } else if (syntax.includes('<percentage>')) {
          initialValue = '0%';
        }
      }
      if (initialValue !== undefined) {
        (inherits ? inherited : notInherited).push({
          prop: atRule.params.trim(),
          value: initialValue
        });
      }
    });
    if (inherited.length === 0 && notInherited.length === 0) {
      return;
    }

    const layer = new AtRule({ name: 'layer', params: 'properties' });
    if (notInherited.length > 0) {
      const rule = new Rule({ selector: '*,::before,::after,::backdrop' });
      notInherited.forEach(({ prop, value }) => rule.append({ prop, value }));
      layer.append(rule);
    }
    if (inherited.length > 0) {
      const rule = new Rule({ selector: ':host' });
      inherited.forEach(({ prop, value }) => rule.append({ prop, value }));
      layer.append(rule);
    }

    // prepend, so `properties` is the first (lowest priority) cascade layer
    root.prepend(layer);
  }
});
shadowDomProperties.postcss = true;

const config = {
  plugins: [
    // handles @import, nesting and vendor prefixes itself; minifies with Lightning CSS
    require('@tailwindcss/postcss')({ optimize: { minify: true } }),
    shadowDomProperties(),
    remToPx(),
    require('postcss-reporter')({
      clearReportedMessages: true,
      throwError: false
    })
  ]
};

module.exports = config;
