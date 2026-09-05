/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALKEMART_API_URL?: string
  readonly VITE_MERCUR_BACKEND_URL?: string
  readonly VITE_CURRENCY_SYMBOL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
