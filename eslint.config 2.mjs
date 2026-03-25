import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'build/**',
      'node_modules/**',
      'supabase/functions/**',
      'src/supabase/**',
      'src/**/* 2.ts',
      'src/**/* 2.tsx',
      'src/**/* 3.ts',
      'src/**/* 3.tsx',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Legacy codebase: tighten gradually; hooks still warn.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'no-case-declarations': 'off',
      'prefer-const': 'warn',
      'no-useless-catch': 'warn',
      'no-empty': 'warn',
      'no-useless-escape': 'warn',
    },
  },
);
