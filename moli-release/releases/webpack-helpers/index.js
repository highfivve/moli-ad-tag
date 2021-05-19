const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HandlebarsPlugin = require('handlebars-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');

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
 * @param publisherName - passed to the handlebar templates as {{publisher}}
 * @param currentFilename - moli.js filename from the releases.json
 * @param basePath - should be `__dirname`
 * @param chunks - chunks that should be included. By default `moli`
 * @param es5Mode - this will be the legacy es5 demo page.
 * @return {[HtmlWebpackPlugin, HandlebarsPlugin, HandlebarsPlugin]}
 */
const makeDocsPages = (
  publisherName,
  currentFilename,
  basePath,
  chunks = ['moli'],
  es5Mode = false
) => {
  return [
    new HtmlWebpackPlugin({
      template: path.join(basePath, 'demo', 'index.hbs'),
      filename: path.join(basePath, 'dist', `demo${es5Mode ? '.es5' : ''}.hbs`),
      scriptLoading: 'defer',
      // only include the main asset
      chunks: chunks,
      // minification breaks handlebars
      minify: false,
      inject: false
    }),
    es5Mode
      ? // no overview page in es5 mode. it will be generated in the es6 bundle routine.
        undefined
      : new HandlebarsPlugin({
          entry: overviewTemplatePath,
          output: path.join(basePath, 'dist', 'overview.html'),
          data: {
            publisher: publisherName,
            releases: require(path.join(basePath, 'releases.json'))
          },
          ...additionalHandlebarsConfig
        }),
    new HandlebarsPlugin({
      htmlWebpackPlugin: {
        enabled: true,
        prefix: 'html',
        HtmlWebpackPlugin
      },
      entry: demoTemplatePath,
      output: path.join(process.cwd(), 'dist', `index${es5Mode ? '.es5' : ''}.html`),
      data: {
        publisher: publisherName,
        currentFilename,
        es5Mode
      },
      ...additionalHandlebarsConfig,
      partials: [...additionalHandlebarsConfig.partials, 'html/*.hbs']
    })
  ].filter(val => !!val);
};

/**
 * The manifest.json is required for the release process to find the moli.js file.
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
