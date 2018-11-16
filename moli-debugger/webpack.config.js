'use strict';

const path = require('path');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
  mode: "development",
  devtool: process.env.NODE_ENV === 'production' ? 'none' : 'inline-source-map',
  entry: './debug.ts',
  output: {
    filename: 'moli-debug.min.js'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        options: {'allowTsInNodeModules': true}
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  plugins: [
    new UglifyJsPlugin({
      sourceMap: false,
      test: /\.min.js$/,
      parallel: true
    }),
  ]
};
