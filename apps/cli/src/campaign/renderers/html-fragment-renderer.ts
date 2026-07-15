import { readFile } from "node:fs/promises"
import { extractHtmlTitle, labelFromFilename } from "../utils.js"
import type { RenderedVibe, VibeRenderer, VibeSource } from "../../types.js"

/** Reads one HTML artifact as the preview fragment served inside the review frame. */
export class HtmlFragmentRenderer implements VibeRenderer {
  readonly extensions = [".html"] as const

  async render(source: VibeSource): Promise<Omit<RenderedVibe, "file" | "id">> {
    const html = await readFile(source.absolutePath, "utf8")

    if (html.trim().length === 0) {
      throw new Error(`${source.relativePath} is empty`)
    }

    return {
      label: extractHtmlTitle(html) ?? labelFromFilename(source.relativePath),
      preview: {
        content: html,
        kind: "html",
      },
    }
  }
}
