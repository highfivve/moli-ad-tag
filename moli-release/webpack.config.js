'use strict';

const path = require('path');

module.exports = (env, argv) => ({
  mode: 'development',
  target: 'node',
  devtool: argv.mode === 'production' ? false : 'inline-source-map',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'lib'),
    filename: 'moli-release.js'
  },
  node: {
    __dirname: false,
    __filename: false
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: { allowTsInNodeModules: true }
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.css']
  }
});
