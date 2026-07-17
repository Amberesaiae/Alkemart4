import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@mercurjs/vendor/index.css"
import "./styles/alkemart-brand.css"
import App from "@mercurjs/vendor"
import { startBrandPatch } from "./brand-patch"

document.title = "alkemart Seller Hub"

if (typeof document !== "undefined") {
  document.documentElement.dataset.brand = "alkemart"
  startBrandPatch()
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
