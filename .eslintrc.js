module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2019,
    sourceType: 'module',
    project: [
      `${__dirname}/tsconfig.json`,
      `${__dirname}/tsconfig.tools.json`,
      `${__dirname}/test-environment/tsconfig.json`,
      `${__dirname}/packages/plugin/tsconfig.json`,
      `${__dirname}/packages/extension/tsconfig.json`,
      `${__dirname}/packages/extension/tsconfig.tools.json`,
      `${__dirname}/packages/e2e/tsconfig.json`,
    ],
    warnOnUnsupportedTypeScriptVersion: false,
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended',
    'plugin:jest/recommended',
  ],
  rules: {
    'no-unused-expressions': 'off',
    'require-await': 'off',
    'prefer-promise-reject-errors': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowConciseArrowFunctionExpressionsStartingWithVoid: true,
      },
    ],
    'prettier/prettier': [
      'error',
      {
        tabWidth: 2,
        useTabs: false,
        semi: false,
        singleQuote: true,
        trailingComma: 'all',
        printWidth: 110,
      },
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        ignoreRestSiblings: true,
      },
    ],
    '@typescript-eslint/no-unused-expressions': [
      'error',
      {
        allowShortCircuit: true,
        allowTernary: true,
      },
    ],
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    'no-restricted-imports': ['error', 'typescript/lib/tsserverlibrary'],
  },
  overrides: [
    {
      files: ['**/*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      files: ['**/*.test.ts', '**/*.spec.ts', '**/test-helpers*.ts'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        'no-restricted-imports': 'off',
      },
    },
  ],
}
