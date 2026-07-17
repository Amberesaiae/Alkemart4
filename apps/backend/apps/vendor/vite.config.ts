import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'

// createRequire (not a static import): the plugin's ESM build can't dynamic-require
// medusa-config.ts, so it silently falls back to base "/" and 404s panel assets.
const require = createRequire(import.meta.url)
const { mercurDashboardPlugin } = require('@mercurjs/dashboard-sdk/vite')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // MUST match browser host for cookies (prefer localhost over 127.0.0.1).
  const backendUrl =
    env.VITE_MERCUR_BACKEND_URL ||
    env.MERCUR_BACKEND_URL ||
    'http://localhost:9000'

  return {
    plugins: [
      react(),
      mercurDashboardPlugin({
        medusaConfigPath: '../../packages/api/medusa-config.ts',
        backendUrl,
        // Display name in login title: "Welcome to {{name}}"
        name: 'alkemart',
        // Public URL (not filesystem path) — AvatarBox uses this as <img src>.
        // base is /seller so the asset is served at /seller/logo.svg
        logo: '/seller/logo.svg',
        enableSellerRegistration: true,
      }),
    ],
  }
})
