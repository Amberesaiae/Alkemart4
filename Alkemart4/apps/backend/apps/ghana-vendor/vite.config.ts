import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

// Dev-mode middleware: the Replit proxy strips the /seller prefix before
// forwarding to this port. A request for the artifact root arrives as
// plain "/" — Vite's base middleware then shows "did you mean /seller/?"
// instead of serving the app. We fix this by reading + transforming
// index.html ourselves for that one path, bypassing Vite's base check.
const replitRootRewrite = {
  name: 'replit-root-rewrite',
  enforce: 'pre' as const,
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url !== '/' && req.url !== '') return next()
      try {
        const fs = await import('node:fs/promises')
        const path = await import('node:path')
        const indexPath = path.resolve(__dirname, 'index.html')
        const raw = await fs.readFile(indexPath, 'utf-8')
        const html = await server.transformIndexHtml('/seller/', raw)
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(html)
      } catch {
        next()
      }
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