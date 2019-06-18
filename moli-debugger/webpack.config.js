'use strict';

const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

const { postCssLoader } = require('./postcss.config');

module.exports = (env, argv) => ({
  mode: 'development',
  devtool: argv.mode === 'production' ? 'none' : 'inline-source-map',
  entry: './debug.tsx',
  output: {
    filename: 'moli-debug.min.js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: { 'allowTsInNodeModules': true }
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: 'style-loader',
            options: {
              attrs: { id: 'moli-debug-styles' }
            }
          },
          postCssLoader(env),
        ]
      }
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js', '.css' ]
  },
  optimization: {
    minimizer: [new UglifyJsPlugin({
      sourceMap: false,
      test: /\.min.js$/,
      parallel: true
    })],
  }
});
