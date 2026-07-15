import { renderToStaticMarkup } from "react-dom/server"
import type { RenderedVibe } from "../../types.js"

/**
 * Produces the isolated iframe document for a Campaign preview at request time.
 * HTML inputs retain their self-contained document; Markdown becomes a safe
 * fragment before this renderer supplies the document shell.
 */
export function renderPreviewDocument(vibe: RenderedVibe): string {
  if (vibe.preview.kind === "html") return vibe.preview.content

  return `<!doctype html>${renderToStaticMarkup(
    <MarkdownVibeDocument body={vibe.preview.content} metadata={vibe.preview.metadata} />
  )}`
}

function MarkdownVibeDocument({
  body,
  metadata,
}: {
  body: string
  metadata: Readonly<Record<string, unknown>>
}): React.JSX.Element {
  const metadataEntries = Object.entries(metadata)

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link href="/viewer-assets/markdown.css" rel="stylesheet" />
      </head>
      <body className="bg-slate-100 p-4 sm:p-8">
        <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-12">
          {metadataEntries.length > 0 ? <MarkdownMetadata entries={metadataEntries} /> : null}
          <div
            className="prose prose-slate max-w-none prose-a:font-medium prose-a:text-blue-700 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-4xl prose-pre:border prose-pre:border-slate-200"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        </article>
      </body>
    </html>
  )
}

function MarkdownMetadata({ entries }: { entries: readonly [string, unknown][] }): React.JSX.Element {
  return (
    <section aria-label="Document metadata" className="mb-8 border-b border-slate-200 pb-6">
      <dl className="m-0 space-y-3">
        {entries.map(([key, value]) => (
          <div
            className="grid gap-1 border-b border-slate-100 pb-3 last:border-0 last:pb-0 sm:grid-cols-[10rem_1fr] sm:gap-4"
            key={key}
          >
            <dt className="font-mono text-xs font-semibold tracking-wide text-slate-500 uppercase">{key}</dt>
            <dd className="m-0 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
              {formatMetadataValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function formatMetadataValue(value: unknown): string {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value)
  if (value === null) return "null"

  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}
