import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 9527,
      host: '127.0.0.1', // Use IPv4 explicitly to avoid DNS timeouts
      strictPort: true, // Don't crash if port is busy, but we want to know
      watch: {
        // Reduced load on file watcher
        ignored: ['**/node_modules/**', '**/.git/**'],
      },
    },
    // Disable source maps to reduce bundle size and load time
    css: { devSourcemap: false },
    build: { sourcemap: false },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    // Pre-bundle these dependencies to speed up dev server startup
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'lucide-react', // Keep this optimzed
        'react-markdown',
        'remark-gfm',
        'date-fns',
        // Tauri plugins removed from here as they might cause IO issues on Windows dev server
      ],
    },
  };
});
