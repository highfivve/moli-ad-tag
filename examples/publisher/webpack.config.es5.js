'use strict';

const path = require('path');

const {
  makeDocsPages,
  manifestPlugin
} = require('@highfivve/moli-release/releases/webpack-helpers');

const releasesJson = require('./releases.json');
const publisherName = 'moli-publisher-example-publisher';

/**
 * Moli ES5 publisher example webpack config
 */

// presets and plugins for Prebid.js must be manually specified separate from your other babel rule.
// this can be accomplished by requiring prebid's .babelrc.js file (requires Babel 7 and Node v8.9.0+)
const babelConfig = {
  loader: 'babel-loader',
  options: require('prebid.js/.babelrc.js')
};

module.exports = (_, argv) => {
  return {
    mode: 'development',
    devtool: argv.mode === 'production' ? false : 'inline-source-map',
    target: ['web', 'es5'],
    entry: {
      moli_es5: './index.es5.ts'
    },
    output: {
      filename: argv.mode === 'production' ? `[name]_[chunkhash].js` : `[name].js`,
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
              options: {
                allowTsInNodeModules: false,
                projectReferences: true
              }
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
      extensions: ['.ts', '.js', '.json']
    },
    plugins: [
      ...makeDocsPages({
        publisherName: publisherName,
        currentFilename: releasesJson.currentFilenameEs5,
        basePath: __dirname,
        chunks: ['moli_es5'],
        es5Mode: true,
        mode: argv.mode || 'development'
      }),
      manifestPlugin(['moli_es5'], true)
    ]
  };
};
