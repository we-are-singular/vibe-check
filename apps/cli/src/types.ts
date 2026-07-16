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

/** The default triage mechanic: pass, keep, or strong positive emphasis. */
export const VOTE_VALUES = ["pass", "keep", "love"] as const
export type Vote = (typeof VOTE_VALUES)[number]

/** Feedback mechanics selectable when a Campaign is opened. */
export const VOTING_SYSTEM_VALUES = ["tinder", "stars", "comment"] as const
export type VotingSystem = (typeof VOTING_SYSTEM_VALUES)[number]

export const STAR_RATINGS = [1, 2, 3, 4, 5] as const
export type StarRating = (typeof STAR_RATINGS)[number]

/** One completed Vibe response, shaped by the Campaign's selected voting system. */
export type Feedback =
  | { kind: "tinder"; vote: Vote }
  | { kind: "stars"; rating: StarRating }
  | { comment: string; kind: "comment" }

/** Returns whether a JSON value is a valid response for the selected voting system. */
export function isFeedbackForVotingSystem(value: unknown, votingSystem: VotingSystem): value is Feedback {
  if (!isRecord(value) || value.kind !== votingSystem) return false

  if (value.kind === "tinder") return typeof value.vote === "string" && VOTE_VALUES.includes(value.vote as Vote)
  if (value.kind === "stars")
    return typeof value.rating === "number" && STAR_RATINGS.includes(value.rating as StarRating)
  return typeof value.comment === "string"
}

/** One browser session's per-Vibe feedback and completion state for the current Campaign. */
export type SessionSnapshot = {
  feedback: Record<string, Feedback>
  isComplete: boolean
  sessionId: string
}

/** Legacy aggregate result, kept compatible with the default Tinder output. */
export type TinderResultRow = {
  file: string
  id: string
  keepCount: number
  label: string
  loveCount: number
}

export type StarResultRow = {
  averageRating: number | null
  file: string
  id: string
  label: string
  ratingCount: number
  votingSystem: "stars"
}

export type CommentResultRow = {
  commentCount: number
  file: string
  id: string
  label: string
  votingSystem: "comment"
}

/** One non-empty comment retained in a running Campaign's current session state. */
export type CommentLog = {
  comment: string
  sessionId: string
  vibe: Pick<RenderedVibe, "file" | "id" | "label">
}

/** Aggregate Campaign result, ranked according to the selected voting system. */
export type ResultRow = TinderResultRow | StarResultRow | CommentResultRow

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
