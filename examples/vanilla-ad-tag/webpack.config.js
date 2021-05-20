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
    entry: {
      moli: './index.ts'
    },
    output: {
      filename: argv.mode === 'production' ? '[name]_[chunkHash].js' : '[name].js'
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          options: { allowTsInNodeModules: false, projectReferences: true }
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.js', '.json']
    },
    // local development
    devServer: {
      contentBase: [
        path.join(__dirname, 'dist'),
        // always use the latest moli-debugger
        '../../moli-debugger/lib'
      ],
      compress: true,
      port: 9000,
      allowedHosts: ['localhost', '.h5v.eu'],
    },
    plugins: [
      ...makeDocsPages(publisherName, releasesJson.currentFilename, __dirname),
      manifestPlugin()
    ]
  };
};
