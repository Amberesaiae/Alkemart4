import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@mercurjs/admin/index.css"
import "./styles/alkemart-brand.css"
import App from "@mercurjs/admin"

document.title = "alkemart Admin"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
