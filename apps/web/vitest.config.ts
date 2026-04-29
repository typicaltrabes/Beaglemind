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
    // Phase 17.1-06: default environment stays `node` so existing lib + route
    // tests (notably extract-attachment, which depends on pdf-parse's Node-
    // worker setup) keep passing. Component render tests opt into happy-dom
    // file-by-file via the `// @vitest-environment happy-dom` annotation —
    // see e.g. components/transcript/user-message-attachments.test.tsx.
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
