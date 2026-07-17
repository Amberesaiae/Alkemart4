/**
 * Single Medusa client surface — prefer MedusaProvider / useMedusa in React.
 * Do not construct `new Medusa(...)` elsewhere.
 */
export {
  createMedusaClient,
  commerceContext,
  requiredEnv,
} from "./medusa/client"
