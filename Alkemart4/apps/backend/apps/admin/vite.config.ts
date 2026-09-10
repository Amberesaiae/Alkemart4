import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  base: '/',
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  plugins: [TanStackRouterVite({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          tanstack: ['@tanstack/react-router', '@tanstack/react-query'],
          icons: ['@phosphor-icons/react'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 3001,
    // Fallback for relative fetches. Prefer VITE_ALKEMART_API_URL=http://127.0.0.1:8787
    proxy: {
      '/admin': 'http://127.0.0.1:8787',
      '/store': 'http://127.0.0.1:8787',
      '/vendor': 'http://127.0.0.1:8787',
      '/hooks': 'http://127.0.0.1:8787',
      '/health': 'http://127.0.0.1:8787',
    },
  },
})

