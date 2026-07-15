import { createHash } from "node:crypto"
import { basename, extname } from "node:path"

/** Produces the stable identifier used to correlate one direct-child artifact with its verdicts. */
export function stableVibeId(relativePath: string): string {
  return createHash("sha256").update(relativePath).digest("hex").slice(0, 16)
}

/** Derives a readable fallback label from an artifact filename. */
export function labelFromFilename(relativePath: string): string {
  const filename = basename(relativePath, extname(relativePath))
  return filename.replace(/^\d+[-_.\s]+/, "") || filename
}

/** Extracts a non-empty document title without executing or parsing candidate HTML. */
export function extractHtmlTitle(html: string): string | null {
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
  if (!title) return null

  const normalized = title
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return normalized.length > 0 ? normalized : null
}
