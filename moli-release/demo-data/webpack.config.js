'use strict';

const path = require('path');
const fs = require('fs');

const { makeDocsPages } = require('@highfivve/moli-release/releases/webpack-helpers');

const distDir = path.resolve(__dirname, 'dist');

fs.mkdirSync(distDir, { recursive: true });

fs.writeFileSync(
  `${distDir}/manifest.json`,
  JSON.stringify({
    moli: 'moli_1337.min.mjs'
  })
);

fs.writeFileSync(
  `${distDir}/manifest.es5.json`,
  JSON.stringify({
    moli_es5: 'moli_es5_f411.min.js'
  })
);

module.exports = (_, argv) => {
  return {
    mode: 'development',
    entry: {
      moli: './index.js',
      moli_es5: './index.js'
    },
    output: {
      filename: 'dummy.js',
      path: distDir,
      publicPath: ''
    },
    resolve: {
      extensions: ['.js']
    },
    plugins: [
      ...makeDocsPages({
        publisherName: 'demo-publisher',
        currentFilename: 'moli.es6.mjs',
        basePath: __dirname,
        mode: 'development',
        chunks: ['moli'],
        es5Mode: false
      }),
      ...makeDocsPages({
        publisherName: 'demo-publisher',
        currentFilename: 'moli.es5.js',
        basePath: __dirname,
        mode: 'development',
        chunks: ['moli_es5'],
        es5Mode: true
      })
    ]
  };
};
