module.exports = {
  postCssLoader: env => {
    return {
      loader: 'postcss-loader',
      options: {
        postcssOptions: {
          plugins: [
            // beware - plugin order matters! check output if you change order!
            require('postcss-import')({
              plugins: [
                require('stylelint')({
                  extends: 'stylelint-config-suitcss',
                  ignoreFiles: [
                    '**/normalize.css',
                    '../**/normalize.css',
                    '**/suitcss-utils-*/**/*.css'
                  ],
                  rules: {
                    'max-line-length': [
                      120,
                      {
                        ignore: 'non-comments'
                      }
                    ],
                    'at-rule-empty-line-before': [
                      'always',
                      {
                        ignore: ['blockless-after-same-name-blockless']
                      }
                    ],
                    'comment-empty-line-before': [
                      'always',
                      {
                        ignore: ['after-comment', 'stylelint-commands']
                      }
                    ],
                    'rule-empty-line-before': [
                      'always',
                      {
                        ignore: ['after-comment']
                      }
                    ]
                  }
                }),
                require('postcss-bem-linter')({
                  preset: 'suit',
                  utilitySelectors: '^.u-[A-Za-z0-9-]+$'
                })
              ]
            }),
            require('postcss-mixins')({}),
            require('postcss-nested')({}),
            require('postcss-custom-properties')({ preserve: false }),
            require('postcss-custom-media')({}),
            require('postcss-extend')({}),
            require('postcss-color-function')({}),
            require('autoprefixer')({
              grid: true
            }),
            require('cssnano')({
              zindex: false, // prevents automatic postprocessing of the z-indexes, so we can define them as we like.
              autoprefixer: { add: false, remove: false }
            }),
            require('postcss-reporter')({
              clearReportedMessages: true,
              throwError: env && env.lint
            })
          ]
        }
      }
    };
  }
};
