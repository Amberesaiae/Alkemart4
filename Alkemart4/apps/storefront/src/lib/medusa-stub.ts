/**
 * Production Workers builds alias @medusajs/js-sdk here so Medusa is not a
 * runtime dependency. Lab builds without VITE_ALKEMART_API_URL keep the real SDK.
 */
export default class MedusaStub {
  client = {
    getToken: async () => null as string | null,
    fetch: async () => {
      throw new Error("Medusa is quarantined in Workers production builds")
    },
  }
  store = new Proxy(
    {},
    {
      get() {
        throw new Error("Medusa is quarantined in Workers production builds")
      },
    },
  )
}
