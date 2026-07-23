// Must run before any pg/knex client is constructed (Neon IPv6 hang on some WSL nets)
import './src/lib/force-ipv4-dns'
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
  // Ghana vendor app — replaces Mercur's vendor panel at /seller
  {
    resolve: '@mercurjs/core/modules/vendor-ui',
    options: {
      appDir: dashboardAppDir('ghana-vendor'),
      path: '/seller',
      viteDevServerPort: 7002,
    },
  },
  // Legacy Mercur vendor panel (full product/offer mgmt) — uncomment to restore
  // {
  //   resolve: '@mercurjs/core/modules/vendor-ui',
  //   options: {
  //     appDir: dashboardAppDir('vendor'),
  //     path: '/seller-legacy',
  //     viteDevServerPort: 7001,
  //   },
  // },
  {
    resolve: '@medusajs/medusa/file',
    options: {
      providers: [
        process.env.FILE_DRIVER === 's3'
          ? {
              // @medusajs/medusa/file-s3 re-exports @medusajs/file-s3
              resolve: '@medusajs/medusa/file-s3',
              id: 's3',
              options: {
                file_url: process.env.S3_FILE_URL,
                access_key_id: process.env.S3_ACCESS_KEY_ID,
                secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
                region: process.env.S3_REGION || 'auto',
                bucket: process.env.S3_BUCKET,
                endpoint: process.env.S3_ENDPOINT,
                prefix: process.env.S3_PREFIX || 'alkemart/',
                // R2 / BucketOwnerEnforced: do not send ACL headers
                acl: false,
                additional_client_config: {
                  forcePathStyle: true,
                },
              },
            }
          : {
              resolve: '@medusajs/medusa/file-local',
              id: 'local',
              options: {
                // Public origin for uploaded file URLs (lab). Production uses S3/R2.
                backend_url:
                  process.env.FILE_BACKEND_URL || 'http://localhost:9000/static',
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
    // Neon TLS: production uses SSL; set DATABASE_NO_SSL=true for local/Replit postgres
    databaseDriverOptions: {
      connection: {
        ssl:
          process.env.DATABASE_NO_SSL === 'true'
            ? false
            : process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true'
              ? { rejectUnauthorized: true }
              : { rejectUnauthorized: false },
      },
    },
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
