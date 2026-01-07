import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    alias: {
      // Mock the openai import for testing
      '../../supabase/functions/server/utils/openai.ts': new URL(
        './src/lib/prompts/__mocks__/openai.ts',
        import.meta.url
      ).pathname,
    },
  },
});
