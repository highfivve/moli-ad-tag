module.exports = {
  env: {
    browser: true,
    es6: true
  },
  extends: ['prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module'
  },
  plugins: ['eslint-plugin-preact', '@typescript-eslint', 'eslint-plugin-jsdoc'],
  rules: {
    '@typescript-eslint/dot-notation': 'error',
    '@typescript-eslint/member-delimiter-style': [
      'error',
      {
        multiline: {
          delimiter: 'semi',
          requireLast: true
        },
        singleline: {
          delimiter: 'semi',
          requireLast: false
        }
      }
    ],
    '@typescript-eslint/member-ordering': 'off',
    '@typescript-eslint/naming-convention': 'off',
    '@typescript-eslint/no-empty-function': 'error',
    '@typescript-eslint/no-parameter-properties': 'off',
    '@typescript-eslint/no-unused-expressions': 'off',
    '@typescript-eslint/no-var-requires': 'error',
    '@typescript-eslint/quotes': [
      'off',
      'single',
      {
        avoidEscape: true
      }
    ],
    '@typescript-eslint/semi': ['error', 'always'],
    '@typescript-eslint/type-annotation-spacing': 'error',
    'comma-dangle': 'error',
    curly: 'error',
    'eol-last': 'error',
    eqeqeq: ['error', 'smart'],
    'guard-for-in': 'error',
    'id-blacklist': 'off',
    'id-match': 'off',
    'jsdoc/check-alignment': 'error',
    'jsdoc/check-indentation': 'off',
    'jsdoc/newline-after-description': 'off',
    'max-len': 'off',
    'no-bitwise': 'error',
    'no-caller': 'error',
    'no-console': [
      'error',
      {
        allow: [
          'log',
          'warn',
          'dir',
          'timeLog',
          'assert',
          'clear',
          'count',
          'countReset',
          'group',
          'groupEnd',
          'table',
          'dirxml',
          'error',
          'groupCollapsed',
          'Console',
          'profile',
          'profileEnd',
          'timeStamp',
          'context'
        ]
      }
    ],
    'no-debugger': 'error',
    'no-empty': 'error',
    'no-eval': 'error',
    'no-fallthrough': 'error',
    'no-new-wrappers': 'error',
    'no-redeclare': 'off',
    'no-underscore-dangle': 'off',
    'no-unused-labels': 'error',
    radix: 'error',
    'spaced-comment': [
      'error',
      'always',
      {
        markers: ['/']
      }
    ]
  }
};
