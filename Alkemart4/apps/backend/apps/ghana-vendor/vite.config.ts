import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

// Dev-mode middleware: the Replit proxy strips the /seller prefix before
// forwarding to this port, so a request for the artifact root arrives as
// plain "/" — Vite would show "did you mean /seller/?" without this rewrite.
const replitRootRewrite = {
  name: 'replit-root-rewrite',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/') req.url = '/seller/'
      next()
    })
  },
}

export default defineConfig({
  base: '/seller/',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  plugins: [TanStackRouterVite(), react(), tailwindcss(), replitRootRewrite],
  optimizeDeps: {
    include: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: true,
    port: 3002,
    proxy: {
      '/vendor': 'http://localhost:9000',
      '/admin': 'http://localhost:9000',
      '/auth': 'http://localhost:9000',
      '/store': 'http://localhost:9000',
    },
  },
})