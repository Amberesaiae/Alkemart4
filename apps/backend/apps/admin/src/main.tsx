import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@mercurjs/admin/index.css"
import "./styles/alkemart-brand.css"
import App from "@mercurjs/admin"
import { startBrandPatch } from "./brand-patch"

document.title = "alkemart Admin"

if (typeof document !== "undefined") {
  document.documentElement.dataset.brand = "alkemart"
  startBrandPatch()
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
