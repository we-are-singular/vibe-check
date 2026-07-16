import { renderPreviewDocument } from "../../../src/campaign/renderers/preview-document.js"

describe("renderPreviewDocument", () => {
  it("renders Markdown frontmatter as escaped structured metadata", () => {
    const document = renderPreviewDocument({
      file: "skill.md",
      id: "skill",
      label: "Vibe Check",
      preview: {
        content: "<p>Markdown body.</p>",
        kind: "markdown",
        metadata: {
          name: "Vibe Check",
          tags: ["agent", "review"],
          unsafe: "<script>ignored()</script>",
        },
      },
    })

    expect(document).toContain('aria-label="Document metadata"')
    expect(document).toContain("<dt")
    expect(document).toContain(">name</dt>")
    expect(document).toContain("Vibe Check")
    expect(document).toContain("[&quot;agent&quot;,&quot;review&quot;]")
    expect(document).toContain("&lt;script&gt;ignored()&lt;/script&gt;")
    expect(document).toContain("<p>Markdown body.</p>")
  })
})
