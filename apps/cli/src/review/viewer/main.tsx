import { createRoot } from "react-dom/client"
import "./viewer.css"
import { ViewerApp } from "./app.js"

const root = document.getElementById("root")

if (!root) {
  throw new Error("Vibe Check viewer requires a #root element.")
}

createRoot(root).render(<ViewerApp />)
