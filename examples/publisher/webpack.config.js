'use strict';

const path = require('path');
const fs = require('fs');

const {
  makeDocsPages,
  manifestPlugin
} = require('@highfivve/moli-release/releases/webpack-helpers');

const releasesJson = require('./releases.json');
const publisherName = 'moli-publisher-example-publisher';

module.exports = (_, argv) => {
  return {
    devtool: argv.mode === 'production' ? 'none' : 'inline-source-map',
    entry: './index.ts',
    output: {
      filename: 'publisher_[chunkHash].js'
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          options: { allowTsInNodeModules: true }
        },
        // this separate rule is required to make sure that the Prebid.js files are babel-ified.  this rule will
        // override the regular exclusion from above (for being inside node_modules).
        {
          test: /.js$/,
          include: new RegExp(`\\${path.sep}prebid\.js`),
          use: {
            loader: 'babel-loader',
            // presets and plugins for Prebid.js must be manually specified separate from your other babel rule.
            // this can be accomplished by requiring prebid's .babelrc.js file (requires Babel 7 and Node v8.9.0+)
            options: require('prebid.js/.babelrc.js')
          }
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.js', '.json']
    },
    // local development
    devServer: {
      https: {
        key: fs.readFileSync(path.join(__dirname, 'certs/selfsigned.key')),
        cert: fs.readFileSync(path.join(__dirname, 'certs/selfsigned.crt')),
        ca: fs.readFileSync(path.join(__dirname, 'certs/selfsigned.pem'))
      },
      contentBase: [
        path.join(__dirname, 'dist'),
        path.join(__dirname, 'yield-config'),
        // always use the latest moli-debugger
        '../../moli-debugger/lib'
      ],
      compress: true,
      port: 9000,
      allowedHosts: ['localhost', '.gutefrage.net', '.h5v.eu'],
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
  };
};
