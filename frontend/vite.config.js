/* eslint-env node */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  // No necesitas loadEnv ni define para variables VITE_*
  // Vite las inyecta automáticamente
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  }
});