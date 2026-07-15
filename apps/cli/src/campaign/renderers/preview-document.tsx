import { renderToStaticMarkup } from "react-dom/server"
import type { RenderedVibe } from "../../types.js"

/**
 * Produces the isolated iframe document for a Campaign preview at request time.
 * HTML inputs retain their self-contained document; Markdown becomes a safe
 * fragment before this renderer supplies the document shell.
 */
export function renderPreviewDocument(vibe: RenderedVibe): string {
  if (vibe.preview.kind === "html") return vibe.preview.content

  return `<!doctype html>${renderToStaticMarkup(<MarkdownVibeDocument body={vibe.preview.content} />)}`
}

function MarkdownVibeDocument({ body }: { body: string }): React.JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link href="/viewer-assets/markdown.css" rel="stylesheet" />
      </head>
      <body>
        <article className="prose prose-slate mx-auto max-w-4xl p-8" dangerouslySetInnerHTML={{ __html: body }} />
      </body>
    </html>
  )
}
