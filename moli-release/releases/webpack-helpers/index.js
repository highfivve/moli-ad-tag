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
 * @return {[HtmlWebpackPlugin, HandlebarsPlugin, HandlebarsPlugin]}
 */
const makeDocsPages = (publisherName, currentFilename, basePath, chunks = ['moli']) => [
  new HtmlWebpackPlugin({
    template: path.join(basePath, 'demo', 'index.hbs'),
    filename: path.join(basePath, 'dist', 'demo.hbs'),
    scriptLoading: 'defer',
    // only include the main asset
    chunks: chunks,
    // minification breaks handlebars
    minify: false
  }),
  new HandlebarsPlugin({
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
    output: path.join(process.cwd(), 'dist', 'index.html'),
    data: {
      publisher: publisherName,
      currentFilename
    },
    ...additionalHandlebarsConfig,
    partials: [...additionalHandlebarsConfig.partials, 'html/*.hbs']
  })
];

/**
 * The manifest.json is required for the release process to find the moli.js file.
 *
 * Assumes that the main ad tag entrypoint is named `moli`.
 */
const manifestPlugin = () =>
  new WebpackManifestPlugin({
    useEntryKeys: true,
    filter: file => file.name === 'moli' && file.isChunk
  });

module.exports = {
  makeDocsPages,
  manifestPlugin
};
