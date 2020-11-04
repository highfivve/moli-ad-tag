const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HandlebarsPlugin = require('handlebars-webpack-plugin');

const overviewTemplatePath = path.join(__dirname, '..', 'overview.hbs');
const demoTemplatePath = path.join(__dirname, '..', 'demo.hbs');

const additionalHandlebarsConfig = {
  helpers: {
    projectHelpers: path.join(__dirname, '..', 'handlebars-helpers', '*.js')
  },
  partials: [path.join(__dirname, '..', 'partials', '*.hbs')]
};

const makeDocsPages = (publisherName, basePath) => [
  new HtmlWebpackPlugin({
    template: path.join(basePath, 'demo', 'index.hbs'),
    filename: path.join(basePath, 'dist', 'demo.hbs'),
    scriptLoading: 'defer'
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
      publisher: publisherName
    },
    ...additionalHandlebarsConfig,
    partials: [...additionalHandlebarsConfig.partials, 'html/*.hbs']
  })
];

module.exports = {
  makeDocsPages
};
