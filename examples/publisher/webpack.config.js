'use strict';

const path = require('path');

const {
  makeDocsPages,
  manifestPlugin
} = require('@highfivve/moli-release/releases/webpack-helpers');

const releasesJson = require('./releases.json');
const publisherName = 'moli-publisher-example-publisher';

/**
 * Moli ES6 publisher example webpack config
 */

// presets and plugins for Prebid.js must be manually specified separate from your other babel rule.
// this can be accomplished by requiring prebid's .babelrc.js file (requires Babel 7 and Node v8.9.0+)
const babelConfig = {
  loader: 'babel-loader',
  options: {
    presets: [
      [
        '@babel/preset-env',
        {
          targets: {
            browsers: [
              'Chrome >= 61',
              'Firefox >= 57',
              'Safari >= 10.1',
              'iOS >= 10.3',
              'Edge >= 15'
            ]
          }
        }
      ]
    ],
    plugins: require('prebid.js/.babelrc.js').plugins
  }
};

module.exports = (_, argv) => ({
  mode: 'development',
  devtool: argv.mode === 'production' ? false : 'inline-source-map',
  target: ['web', 'es2015'],
  entry: {
    moli: './index.ts'
  },
  output: {
    filename: argv.mode === 'production' ? `[name]_[chunkhash].mjs` : `[name].mjs`,
    path: path.resolve(__dirname, 'dist'),
    publicPath: ''
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          babelConfig,
          {
            loader: 'ts-loader',
            options: { allowTsInNodeModules: false, projectReferences: true }
          }
        ]
      },
      // this separate rule is required to make sure that the Prebid.js files are babel-ified.  this rule will
      // override the regular exclusion from above (for being inside node_modules).
      {
        test: /.js$/,
        include: new RegExp(`\\${path.sep}prebid\.js`),
        use: [babelConfig]
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js', '.mjs', '.json']
  },
  // local development
  devServer: {
    https: true,
    contentBase: [
      path.join(__dirname, 'dist'),
      path.join(__dirname, 'yield-config'),
      // always use the latest moli-debugger
      '../../moli-debugger/lib'
    ],
    compress: true,
    port: 9000,
    allowedHosts: ['localhost', '.gutefrage.net', '.h5v.eu'],
    writeToDisk: true,
    // configure a mock yield config server
    before: app => {
      // parse the req body as json
      const bodyParser = require('body-parser');
      app.use(bodyParser.json());

      // yield config endpoint
      app.post('/yield-config.json', (req, res) => {
        res.sendFile(`yield-config.${req.body.device}.json`, {
          root: path.join(__dirname, 'yield-config')
        });
      });
    }
  },
  plugins: [
    ...makeDocsPages(publisherName, releasesJson.currentFilename, __dirname),
    manifestPlugin()
  ]
});
