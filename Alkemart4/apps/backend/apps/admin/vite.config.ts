import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

const isDev = process.env.NODE_ENV !== 'production'

export default defineConfig({
  // In dev, serve at root so the Replit preview (port 3001) works directly.
  // Production builds are still loaded by Medusa at /dashboard/.
  base: isDev ? '/' : '/dashboard/',
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  plugins: [TanStackRouterVite({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  server: {
    host: true,
    port: 3001,
    proxy: {
      '/admin': 'http://localhost:9000',
      '/auth': 'http://localhost:9000',
      '/vendor': 'http://localhost:9000',
      '/store': 'http://localhost:9000',
    },
  },
})
