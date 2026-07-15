/** Shared models exchanged between campaign loading, review storage, and the viewer. */
export type MarkdownMetadata = Readonly<Record<string, unknown>>

export type VibePreview =
  | {
      content: string
      kind: "html"
    }
  | {
      content: string
      kind: "markdown"
      metadata: MarkdownMetadata
    }

export type VibeSource = {
  absolutePath: string
  id: string
  relativePath: string
}

/** Converts one source artifact into preview content for the review flow. */
export interface VibeRenderer {
  readonly extensions: readonly string[]

  render(source: VibeSource): Promise<Omit<RenderedVibe, "file" | "id">>
}

export type RenderedVibe = {
  file: string
  id: string
  label: string
  preview: VibePreview
}

/** The three verdicts a reviewer may submit for one Vibe. */
export const VOTE_VALUES = ["pass", "keep", "love"] as const
export type Vote = (typeof VOTE_VALUES)[number]

/** One browser session's immutable verdicts for the current Campaign. */
export type SessionSnapshot = {
  sessionId: string
  votes: Record<string, Vote>
}

/** Aggregate counts returned after a reviewer has completed a Campaign. */
export type ResultRow = {
  file: string
  id: string
  keepCount: number
  label: string
  loveCount: number
}
