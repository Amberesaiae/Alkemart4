import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  base: '/seller/',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
  optimizeDeps: {
    include: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 3002,
    proxy: {
      '/vendor': 'http://localhost:9000',
      '/admin': 'http://localhost:9000',
      '/auth': 'http://localhost:9000',
      '/store': 'http://localhost:9000',
    },
  },
})
