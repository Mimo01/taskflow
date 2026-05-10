import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(process.env.APP_VERSION ?? '0.0.0-dev'),
    'import.meta.env.APP_COMMIT_SHA': JSON.stringify(process.env.APP_COMMIT_SHA ?? 'dev'),
    'import.meta.env.APP_BUILD_DATE': JSON.stringify(process.env.APP_BUILD_DATE ?? 'unknown'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    passWithNoTests: true,
  },
});
