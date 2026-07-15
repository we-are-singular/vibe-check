import { existsSync } from "node:fs"
import { lstat, readFile } from "node:fs/promises"
import { dirname, extname, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

/** One binary file emitted by the built React viewer. */
export type ViewerAsset = {
  body: Buffer
  contentType: string
}

/** Provides the built viewer document and its allowlisted static assets. */
export type ViewerAssetSource = {
  indexHtml(): Promise<string>
  asset(pathname: string): Promise<ViewerAsset | null>
}

type ViteManifestEntry = {
  css?: readonly string[]
  isEntry?: boolean
}

type ViteManifest = Record<string, ViteManifestEntry>

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
}

/** Reads the Vite-built viewer and restricts static serving to its output directory. */
export class ViewerAssets {
  private markdownStylesheetPath: Promise<string> | undefined

  constructor(private readonly directory = resolveViewerDirectory()) {}

  async indexHtml(): Promise<string> {
    return readFile(resolve(this.directory, "index.html"), "utf8")
  }

  async asset(pathname: string): Promise<ViewerAsset | null> {
    const requestedPath = pathname === "markdown.css" ? await this.markdownStylesheet() : pathname
    const file = resolve(this.directory, requestedPath)
    const contentType = CONTENT_TYPES[extname(file).toLowerCase()]

    if (
      contentType === undefined ||
      requestedPath.split(/[\\/]/).some(segment => segment.startsWith(".")) ||
      !file.startsWith(`${this.directory}${sep}`)
    ) {
      return null
    }

    try {
      const metadata = await lstat(file)
      if (!metadata.isFile() || metadata.isSymbolicLink()) return null

      return {
        body: await readFile(file),
        contentType,
      }
    } catch {
      return null
    }
  }

  private markdownStylesheet(): Promise<string> {
    this.markdownStylesheetPath ??= this.readMarkdownStylesheet()
    return this.markdownStylesheetPath
  }

  private async readMarkdownStylesheet(): Promise<string> {
    const manifest = JSON.parse(await readFile(resolve(this.directory, ".vite/manifest.json"), "utf8")) as ViteManifest
    const entry = Object.values(manifest).find(candidate => candidate.isEntry)
    const stylesheet = entry?.css?.[0]

    if (stylesheet === undefined) {
      throw new Error("The built review viewer does not include a stylesheet for Markdown previews.")
    }

    return stylesheet
  }
}

function resolveViewerDirectory(): string {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url))
  const bundledDirectory = resolve(moduleDirectory, "viewer")

  // The production bundle sits beside dist/viewer; source-mode CLI runs use its built output.
  return existsSync(resolve(bundledDirectory, ".vite/manifest.json"))
    ? bundledDirectory
    : resolve(moduleDirectory, "../../dist/viewer")
}
