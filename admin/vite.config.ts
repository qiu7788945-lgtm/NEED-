import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';

const adminDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: adminDir,
  build: {
    outDir: resolve(adminDir, 'dist'),
    emptyOutDir: true,
  },
});
