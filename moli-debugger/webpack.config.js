'use strict';

const path = require('path');

const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const { postCssLoader } = require('./postcss.config');

module.exports = (env, argv) => ({
  mode: 'development',
  devtool: argv.mode === 'production' ? 'none' : 'inline-source-map',
  entry: './debug.tsx',
  output: {
    path: path.resolve(__dirname, 'lib'),
    filename: 'moli-debug.min.js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: { allowTsInNodeModules: true }
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: 'style-loader',
            options: {
              attributes: { id: 'moli-debug-styles' }
            }
          },
          'css-loader',
          postCssLoader(env)
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.css'],
    plugins: [new TsconfigPathsPlugin()]
  },
  optimization: {
    minimizer: [
      new UglifyJsPlugin({
        sourceMap: false,
        test: /\.min.js$/,
        parallel: true
      })
    ]
  }
});
