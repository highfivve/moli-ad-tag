'use strict';

const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (_, argv) => {
  return {
    devtool: argv.mode === 'production' ? 'none' : 'inline-source-map',
    entry: {
      adtag: './index.ts',
      app: './source/demo/app.tsx'
    },
    output: {
      filename: '[name]_[chunkHash].js'
    },
    module: {
      rules: [
        {
          test: /\.ts(x?)$/,
          loader: 'ts-loader',
          options: {'allowTsInNodeModules': true}
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js']
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
