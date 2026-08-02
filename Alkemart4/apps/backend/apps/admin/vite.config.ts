import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  base: '/dashboard/',
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  plugins: [TanStackRouterVite({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  build: {
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
    port: 3001,
    proxy: {
      '/admin': 'http://localhost:9000',
      '/auth': 'http://localhost:9000',
    },
  },
})
