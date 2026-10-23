import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/drizzle/**', '**/.private/**', 'references/**', '.agents/**', '.codex/**', 'price_list.html', 'payment/lib/**', 'apps/web/public/**'] },
  {
    files: ['apps/*/src/**/*.{ts,tsx}', 'apps/*/scripts/**/*.ts', 'packages/*/src/**/*.ts', 'scripts/*.mjs'],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.browser, ...globals.node, __BUILD_TIME__: 'readonly' } },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'off', // TypeScript resolves imported types and ambient globals.
      'no-unused-vars': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-dupe-class-members': 'off',
      'no-control-regex': 'off', // Intentional PDF and identity-text normalization.
      'no-misleading-character-class': 'off', // Identity normalization intentionally strips zero-width joiners.
      'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true }],
    },
  },
];
