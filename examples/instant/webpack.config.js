'use strict';

const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');

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
        // always use the latest moli-debugger
        '../../moli-debugger/lib'
      ],
      compress: true,
      port: 9000,
      allowedHosts: ['localhost', '.h5v.eu']
    },
    plugins: [
      new HtmlWebpackPlugin({
        title: 'Instant / Eager Init - Publisher Demo Page',
        template: 'demo/index.html'
      })
    ]
  };
};
