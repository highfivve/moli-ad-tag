'use strict';

const packageJson = require('./package.json');

module.exports = (_, argv) => {
  return {
    mode: 'development',
    devtool: argv.mode === 'production' ? false : 'inline-source-map',
    entry: {
      [`adtag.${packageJson.version}`]: './index.ts',
      latest: './index.ts'
    },
    output: {
      filename: '[name].js'
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
    }
  };
};
