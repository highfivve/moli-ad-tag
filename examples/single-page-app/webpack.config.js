'use strict';

const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');

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
          options: {'allowTsInNodeModules': true}
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.js']
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
        // always use the latest moli-debugger
        '../../moli-debugger/dist'
      ],
      compress: true,
      port: 9000,
      allowedHosts: [
        'localhost',
        '.h5v.eu'
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        title: 'Publisher / SPA - Publisher Demo Page',
        publisher: 'Demo Publisher GmbH',
        template: 'demo/index.html'
      })
    ]
  }
};
