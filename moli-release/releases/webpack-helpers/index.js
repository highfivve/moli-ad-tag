const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HandlebarsPlugin = require('handlebars-webpack-plugin');
const {WebpackManifestPlugin} = require('webpack-manifest-plugin');

const overviewTemplatePath = path.join(__dirname, '..', 'overview.hbs');
const demoTemplatePath = path.join(__dirname, '..', 'demo.hbs');

const additionalHandlebarsConfig = {
  helpers: {
    projectHelpers: path.join(__dirname, '..', 'handlebars-helpers', '*.js')
  },
  partials: [path.join(__dirname, '..', 'partials', '*.hbs')]
};

/**
 * Assumes that the main ad tag entrypoint is named `moli`.
 *
 * @param {Object} options - The employee who is responsible for the project.
 * @param {string} options.publisherName passed to the handlebar templates as {{publisher}}.
 * @param {string} options.currentFilename moli.js filename from the releases.json.
 * @param {string} options.basePath should be `__dirname`.
 * @param {('production'|'development')} options.mode the mode (production|development) that the current build runs in.
 * @param {string[]} [options.chunks=['moli']] chunks that should be included. By default `moli`
 * @param {boolean} [options.es5Mode=false] this will be the legacy es5 demo page. By default false
 * @param {boolean} [options.inject=false] inject the chunks on the html pages
 * @return {[HtmlWebpackPlugin, HandlebarsPlugin, HandlebarsPlugin]}
 */
const makeDocsPages = options => {
  const {
    publisherName,
    currentFilename,
    basePath,
    mode,
    chunks = ['moli'],
    es5Mode = false,
    inject = false
  } = options;

  return [
    // Create overview page only once and only in es6 mode.
    es5Mode
      ? undefined
      : new HandlebarsPlugin({
        entry: overviewTemplatePath,
        output: path.join(basePath, 'dist', 'overview.html'),
        data: {
          publisher: publisherName,
          releases: require(path.join(basePath, 'releases.json'))
        },
        ...additionalHandlebarsConfig
      }),
    ...chunks.flatMap((chunk) => {
      // Map the default chunk (moli) to index to receive an index.html without further configuration
      const outputFileName = (chunk === 'moli' || chunk === 'moli_es5') ? 'index' : chunk;

      const demoPartial = `demo.${chunk}${es5Mode ? '.es5' : ''}`;

      return [
        new HtmlWebpackPlugin({
          template: path.join(basePath, 'demo', 'index.hbs'),
          filename: path.join(basePath, 'dist', `${demoPartial}.hbs`),
          scriptLoading: 'defer',
          // only include the main asset
          chunks: [chunk],
          // minification breaks handlebars
          minify: false,
          inject: inject
        }),
        new HandlebarsPlugin({
          htmlWebpackPlugin: {
            enabled: true,
            prefix: 'html',
            HtmlWebpackPlugin
          },
          entry: demoTemplatePath,
          output: path.join(process.cwd(), 'dist', `${outputFileName}${es5Mode ? '.es5' : ''}.html`),
          data: {
            publisher: publisherName,
            currentFilename,
            es5Mode,
            production: mode === 'production',
            demoPartial: `html/${demoPartial}`
          },
          ...additionalHandlebarsConfig,
          partials: [...additionalHandlebarsConfig.partials, 'html/*.hbs']
        })
      ];
    })
  ].filter(val => !!val);
};

/**
 * The manifest.json is required for the release process to find the moli.js file.
 *
 * @param {string[]} [chunkNames=['moli']] chunks that should be included. By default `moli`
 * @param {boolean} [es5Mode=false] this will be the legacy es5 manifest file. By default false
 */
const manifestPlugin = (chunkNames = ['moli'], es5Mode = false) =>
  new WebpackManifestPlugin({
    useEntryKeys: true,
    filter: file => chunkNames.some(chunkName => file.name.startsWith(chunkName)) && file.isChunk,
    fileName: es5Mode ? 'manifest.es5.json' : 'manifest.json'
  });

module.exports = {
  makeDocsPages,
  manifestPlugin
};
