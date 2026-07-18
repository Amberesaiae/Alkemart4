import { loadEnv } from '@medusajs/framework/utils'
import { withMercur } from '@mercurjs/core'
import fs from 'fs'
import path from 'path'
import { loadAppEnv } from './src/lib/env'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const env = loadAppEnv()

// Resolves where a dashboard app lives:
// - in the source tree (development): ../../apps/<name>
// - in the production build artifact: hosts that deploy only `.medusa/server` (for example
//   Medusa Cloud) get the panels bundled into ./dashboards/<name> by
//   scripts/bundle-dashboards.mjs during `build`. The compiled config runs from the
//   artifact root, so __dirname points there.
const dashboardAppDir = (name: string) => {
  const bundled = path.join(__dirname, 'dashboards', name)
  return fs.existsSync(bundled) ? bundled : path.join(__dirname, `../../apps/${name}`)
}

/**
 * Optional modules (Alkemart). Paystack is registered only when
 * PAYSTACK_SECRET_KEY is set so local boot works without payment keys.
 */
const alkemartModules: Array<Record<string, unknown>> = [
  {
    resolve: '@mercurjs/core/modules/admin-ui',
    options: {
      appDir: dashboardAppDir('admin'),
      path: '/dashboard',
    },
  },
  {
    resolve: '@mercurjs/core/modules/vendor-ui',
    options: {
      appDir: dashboardAppDir('vendor'),
      path: '/seller',
    },
  },
  {
    resolve: '@medusajs/medusa/file',
    options: {
      providers: [
        {
          resolve: '@medusajs/medusa/file-local',
          id: 'local',
          options: {
            // The local provider bakes this into every uploaded file URL.
            // It must be the publicly reachable origin in production, or
            // images resolve to localhost and render broken.
            backend_url: process.env.FILE_BACKEND_URL || 'http://localhost:9000/static',
          },
        },
      ],
    },
  },
]

if (env.PAYSTACK_SECRET_KEY) {
  alkemartModules.push({
    resolve: '@medusajs/medusa/payment',
    options: {
      providers: [
        {
          resolve: './src/modules/paystack',
          id: 'paystack',
          options: {
            secretKey: env.PAYSTACK_SECRET_KEY,
            publicKey: env.PAYSTACK_PUBLIC_KEY,
          },
        },
      ],
    },
  })
}

module.exports = withMercur({
  projectConfig: {
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    http: {
      storeCors: env.STORE_CORS,
      adminCors: env.ADMIN_CORS,
      vendorCors: env.VENDOR_CORS,
      authCors: env.AUTH_CORS,
      jwtSecret: env.JWT_SECRET,
      cookieSecret: env.COOKIE_SECRET,
    }
  },
  featureFlags: {
    seller_registration: true
  },
  modules: alkemartModules,
})
