const globals = require('globals');
const js = require('@eslint/js');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = [
  {
    ignores: ['node_modules/', 'api_test_scripts/'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/modules/*/{controller,service,repository,routes,validation}/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '../../*/controller/*',
            '../../*/service/*',
            '../../*/repository/*',
            '../../*/validation/*',
            '../../*/routes/*',
            '../../../controllers/*',
            '../../../services/*',
            '../../../repositories/*',
            '../../../validations/*',
            '../../../routes/*',
            '../../../middlewares/*',
            '../../../utils/*',
            '../../../config/*',
          ],
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.js'],
    rules: {
      'no-console': 'off',
    },
  },
  eslintPluginPrettierRecommended,
];
