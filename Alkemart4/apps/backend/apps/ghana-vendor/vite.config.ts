import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  // Separate Cloudflare Pages project `alkemart4-vendor` serves from domain root.
  base: '/',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  plugins: [TanStackRouterVite({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  optimizeDeps: {
    include: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          tanstack: ['@tanstack/react-router', '@tanstack/react-query'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 3002,
    // Fallback for relative fetches. Prefer VITE_ALKEMART_API_URL=http://127.0.0.1:8787
    proxy: {
      '/vendor': 'http://127.0.0.1:8787',
      '/admin': 'http://127.0.0.1:8787',
      '/store': 'http://127.0.0.1:8787',
      '/hooks': 'http://127.0.0.1:8787',
      '/health': 'http://127.0.0.1:8787',
    },
  },
})

