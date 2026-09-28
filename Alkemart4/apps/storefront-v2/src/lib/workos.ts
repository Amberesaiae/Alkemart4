import { WorkosBrowser } from "@workspace/console-ui/lib/workos-browser"
import { getAlkemartApiUrl } from "./env"
export const workosEnabled = import.meta.env.VITE_WORKOS_ENABLED === "1"
export const workosBrowser = new WorkosBrowser(() => import.meta.env.DEV ? getAlkemartApiUrl() : window.location.origin, "store")
