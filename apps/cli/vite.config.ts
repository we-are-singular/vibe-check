import { builtinModules } from "node:module"
import { resolve } from "node:path"
import { defineConfig } from "vite"

const nodeExternal = [
  ...builtinModules,
  ...builtinModules.map(moduleName => `node:${moduleName}`),
  "react",
  "react-dom",
  "react-dom/server",
]

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rolldownOptions: {
      external: nodeExternal,
      output: {
        codeSplitting: false,
        banner: [
          "#!/usr/bin/env node",
          'import { createRequire as __createRequire } from "node:module";',
          "globalThis.require = __createRequire(import.meta.url);",
        ].join("\n"),
      },
    },
    target: "node22",
    minify: false,
    sourcemap: true,
  },
})
