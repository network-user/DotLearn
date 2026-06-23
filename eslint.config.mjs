import js from '@eslint/js';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Surface accessibility issues without blocking CI: every jsx-a11y rule runs as a
// warning, so the ARIA / tap-target conventions in AGENTS.md get machine-checked
// while the existing backlog is worked down.
const a11yRecommended =
  jsxA11yPlugin.flatConfigs?.recommended?.rules ?? jsxA11yPlugin.configs.recommended.rules;
const a11yAsWarnings = Object.fromEntries(
  Object.keys(a11yRecommended).map((rule) => [rule, 'warn']),
);

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/.vite/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.config.{js,mjs,cjs,ts}',
      'scripts/**',
      '**/_*.{js,mjs,cjs}',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
    },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...a11yAsWarnings,
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
    settings: { react: { version: '18.3' } },
  },
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    files: ['**/*.{mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['topics/**'],
    rules: {},
  },
];
