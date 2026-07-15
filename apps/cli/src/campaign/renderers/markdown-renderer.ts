import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { labelFromFilename } from "../utils.js"
import type { RenderedVibe, VibeRenderer, VibeSource } from "../../types.js"

type MarkdownToken = {
  readonly tag: string
  readonly type: string
  readonly content: string
  readonly children?: readonly MarkdownToken[]
}

type MarkdownIt = {
  parse(source: string, environment: Record<string, unknown>): readonly MarkdownToken[]
  render(source: string): string
}

type MarkdownItFactory = (
  presetName: "commonmark",
  options: {
    html: false
    linkify: false
    typographer: false
  }
) => MarkdownIt

const loadModule = createRequire(import.meta.url)
const createMarkdownIt = loadModule("markdown-it") as MarkdownItFactory
const markdown = createMarkdownIt("commonmark", {
  html: false,
  linkify: false,
  typographer: false,
})

/** Renders Markdown as a static, non-executable preview for the review flow. */
export class MarkdownRenderer implements VibeRenderer {
  readonly extensions = [".md", ".markdown"] as const

  async render(source: VibeSource): Promise<Omit<RenderedVibe, "file" | "id">> {
    const markdownSource = await readFile(source.absolutePath, "utf8")

    if (markdownSource.trim().length === 0) {
      throw new Error(`${source.relativePath} is empty`)
    }

    return {
      label: extractFirstHeading(markdown.parse(markdownSource, {})) ?? labelFromFilename(source.relativePath),
      preview: {
        content: markdown.render(markdownSource),
        kind: "markdown",
      },
    }
  }
}

function extractFirstHeading(tokens: readonly MarkdownToken[]): string | null {
  const headingIndex = tokens.findIndex(token => token.type === "heading_open" && token.tag === "h1")
  if (headingIndex === -1) return null

  const inlineToken = tokens[headingIndex + 1]
  if (inlineToken?.type !== "inline") return null

  const text = inlineToken.children
    ?.flatMap(token => {
      if (token.type === "softbreak" || token.type === "hardbreak") return [" "]
      return token.type === "text" || token.type === "code_inline" || token.type === "image" ? [token.content] : []
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()

  return text && text.length > 0 ? text : null
}
