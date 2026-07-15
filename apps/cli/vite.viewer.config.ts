import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

/** Builds the static React viewer that ReviewServer serves in production. */
export default defineConfig({
  base: "/viewer-assets/",
  root: resolve(__dirname, "src/review/viewer"),
  plugins: [react(), tailwindcss()],
  build: {
    assetsDir: "assets",
    emptyOutDir: false,
    manifest: true,
    outDir: resolve(__dirname, "dist/viewer"),
    rollupOptions: {
      input: "index.html",
    },
    target: "es2022",
  },
})
