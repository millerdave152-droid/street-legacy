/// <reference types="vite/client" />
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5175,
    strictPort: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split Phaser into its own chunk
          if (id.includes('node_modules/phaser')) {
            return 'vendor-phaser';
          }
          // Split Howler into its own chunk
          if (id.includes('node_modules/howler')) {
            return 'vendor-audio';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1600,
    // Use esbuild instead of terser - 10x faster
    minify: 'esbuild',
    sourcemap: false,
    target: 'es2020',
    // Reduce CSS processing overhead
    cssMinify: 'esbuild',
    // Skip gzip size calculation - saves time
    reportCompressedSize: false
  },
  // Faster dependency pre-bundling
  optimizeDeps: {
    include: ['phaser', 'howler']
  },
  // esbuild options for faster minification
  esbuild: {
    legalComments: 'none',
    drop: ['console', 'debugger']
  }
});
