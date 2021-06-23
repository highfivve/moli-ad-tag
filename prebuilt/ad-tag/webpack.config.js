'use strict';

const path = require('path');
const packageJson = require('./package.json');

module.exports = (_, argv) => {
  return {
    mode: 'development',
    devtool: argv.mode === 'production' ? false : 'inline-source-map',
    entry: {
      [`adtag.${packageJson.version}`] : './index.ts',
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
    }
  };
};
