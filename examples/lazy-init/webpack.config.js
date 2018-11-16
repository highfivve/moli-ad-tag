'use strict';

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');


module.exports = {
  devtool: process.env.NODE_ENV === 'production' ? 'none' : 'inline-source-map',
  entry: './index.ts',
  output: {
    filename: 'self_contained_[chunkHash].js'
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
  // local development
  devServer: {
    https: true,
    contentBase: path.join(__dirname, 'dist'),
    compress: true,
    port: 9000,
    allowedHosts: [
      'localhost',
      '.gutefrage.net'
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Publisher Demo Page',
      template: 'demo/index.html'
    })
  ]
};
