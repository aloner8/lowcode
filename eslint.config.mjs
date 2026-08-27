import next from 'eslint-config-next';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * ESLint flat config.
 *
 * eslint-config-next 16 ships flat config directly, so the FlatCompat wrapper
 * the v15 setup needed is gone. The TypeScript preset is a separate entry
 * point and must be included for the @typescript-eslint rules below to resolve.
 */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/YII/**',
      'next-env.d.ts',
      'coverage/**',
      'storage/**',
    ],
  },
  ...next,
  ...nextTypescript,
  {
    rules: {
      // The JSON AST is intentionally loosely typed at the component boundary.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      /*
       * React Compiler rules, newly enabled as errors by eslint-config-next 16.
       * They flag ~50 pre-existing patterns across the Studio and shared
       * components. The findings are legitimate and worth working through, but
       * that is a refactor in its own right — kept as warnings so they stay
       * visible without blocking CI on an unrelated upgrade.
       */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
];

export default config;
