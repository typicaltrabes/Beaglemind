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
    // Phase 17.1-06: happy-dom provides the DOM emulation @testing-library/react
    // needs to render UserMessageAttachments and friends. The 13-02 follow-up
    // ("install @testing-library/react + happy-dom in a dedicated test
    // infrastructure plan") landed here because the transcript chip render
    // tests required it.
    environment: 'happy-dom',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
