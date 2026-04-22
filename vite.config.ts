import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          'free-tool': path.resolve(__dirname, 'free-tool.html'),
        },
        output: {
          manualChunks(id) {
            if (id.includes('jspdf') || id.includes('jsPDF')) {
              return 'vendor-jspdf';
            }
            if (id.includes('framer-motion') || id.includes('framer_motion')) {
              return 'vendor-framer';
            }
            if (id.includes('@supabase') || id.includes('supabase-js')) {
              return 'vendor-supabase';
            }
            if (id.includes('@google/genai') || id.includes('google_genai')) {
              return 'vendor-genai';
            }
            if (id.includes('lucide-react') || id.includes('lucide_react')) {
              return 'vendor-lucide';
            }
            if (id.includes('groq-sdk') || id.includes('groq/') || (id.includes('node_modules/groq'))) {
              return 'vendor-groq';
            }
            if (id.includes('browser-image-compression') || id.includes('dom-to-image')) {
              return 'vendor-imaging';
            }
            if (id.includes('node_modules/motion/') || id.includes('node_modules/motion-')) {
              return 'vendor-motion';
            }
            if (id.includes('node_modules/groq') || id.includes('/_groq/')) {
              return 'vendor-groq';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      historyApiFallback: true,
    },
  };
});
