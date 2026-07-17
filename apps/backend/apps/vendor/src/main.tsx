import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@mercurjs/vendor/index.css"
import "./styles/alkemart-brand.css"
import App from "@mercurjs/vendor"

document.title = "alkemart Seller Hub"

// Soften any residual third-party chrome after paint
if (typeof document !== "undefined") {
  document.documentElement.dataset.brand = "alkemart"
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
