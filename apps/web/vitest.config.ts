import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // The React plugin transforms JSX so .tsx test sources (and any .tsx
  // modules they import) parse cleanly under Vite's import-analysis. Without
  // it, importing a .tsx module from a vitest test fails with "invalid JS
  // syntax" — see Plan 13-02 deviations.
  plugins: [react()],
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
