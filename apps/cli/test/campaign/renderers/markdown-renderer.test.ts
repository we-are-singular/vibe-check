import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { MarkdownRenderer } from "../../../src/campaign/renderers/markdown-renderer.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
})

async function renderMarkdown(relativePath: string, source: string) {
  const directory = await mkdtemp(join(tmpdir(), "vibe-check-markdown-"))
  temporaryDirectories.push(directory)
  const absolutePath = join(directory, relativePath)
  await writeFile(absolutePath, source)

  return new MarkdownRenderer().render({
    absolutePath,
    id: "vibe-1",
    relativePath,
  })
}

describe("MarkdownRenderer", () => {
  it("uses the first H1 as the label and returns a prose fragment", async () => {
    const rendered = await renderMarkdown("brief.md", "# A **great** idea\n\nSome supporting prose.")

    expect(rendered.label).toBe("A great idea")
    expect(rendered.preview.kind).toBe("markdown")
    if (rendered.preview.kind !== "markdown") throw new Error("Expected a Markdown preview.")
    expect(rendered.preview.content).toContain("<p>Some supporting prose.</p>")
  })

  it("falls back to the filename when the document has no H1", async () => {
    const rendered = await renderMarkdown("design-notes.md", "## Details\n\nNo top-level heading here.")

    expect(rendered.label).toBe("design-notes")
  })

  it("parses frontmatter, uses its name as the fallback label, and excludes it from prose", async () => {
    const rendered = await renderMarkdown(
      "skill.md",
      "---\nname: Vibe Check\ndescription: Gather feedback\ntags:\n  - agent\n  - review\n---\n\nMarkdown body."
    )

    expect(rendered.label).toBe("Vibe Check")
    if (rendered.preview.kind !== "markdown") throw new Error("Expected a Markdown preview.")
    expect(rendered.preview.metadata).toEqual({
      name: "Vibe Check",
      description: "Gather feedback",
      tags: ["agent", "review"],
    })
    expect(rendered.preview.content).toContain("<p>Markdown body.</p>")
    expect(rendered.preview.content).not.toContain("description: Gather feedback")
  })

  it("renders reference links", async () => {
    const rendered = await renderMarkdown(
      "references.md",
      "# References\n\n[Vibe Check][docs]\n\n[docs]: https://example.com"
    )

    if (rendered.preview.kind !== "markdown") throw new Error("Expected a Markdown preview.")
    expect(rendered.preview.content).toContain('<a href="https://example.com">Vibe Check</a>')
  })

  it("escapes raw script HTML rather than emitting executable markup", async () => {
    const rendered = await renderMarkdown("safe.md", "# Safe\n\n<script>window.pwned = true</script>")

    if (rendered.preview.kind !== "markdown") throw new Error("Expected a Markdown preview.")
    expect(rendered.preview.content).toContain("&lt;script&gt;window.pwned = true&lt;/script&gt;")
    expect(rendered.preview.content).not.toContain("<script>window.pwned = true</script>")
  })
})
