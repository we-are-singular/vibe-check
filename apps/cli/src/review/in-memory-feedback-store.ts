import { randomBytes } from "node:crypto"
import type {
  CommentLog,
  CommentResultRow,
  Feedback,
  RenderedVibe,
  ResultRow,
  SessionSnapshot,
  StarResultRow,
  TinderResultRow,
  VotingSystem,
} from "../types.js"
import { isFeedbackForVotingSystem } from "../types.js"

export type RecordedFeedback = {
  eventId: string
  feedback: Feedback
  sessionId: string
  vibe: Pick<RenderedVibe, "file" | "id" | "label">
}

type FeedbackRecorder = (record: RecordedFeedback) => Promise<void>

export type InMemoryFeedbackStoreOptions = {
  readonly recordAcceptedFeedback?: FeedbackRecorder
  readonly votingSystem?: VotingSystem
}

/**
 * Process-local feedback state for the POC. It intentionally disappears on restart;
 * durable local Campaign state is a later vertical slice.
 */
export class InMemoryFeedbackStore {
  private readonly feedbackBySession = new Map<string, Map<string, Feedback>>()
  private readonly feedbackEventCountsBySession = new Map<string, Map<string, number>>()
  private readonly completedSessionIds = new Set<string>()
  private readonly vibesById: ReadonlyMap<string, RenderedVibe>
  readonly votingSystem: VotingSystem

  constructor(
    private readonly vibes: readonly RenderedVibe[],
    { recordAcceptedFeedback, votingSystem = "tinder" }: InMemoryFeedbackStoreOptions = {}
  ) {
    this.recordAcceptedFeedback = recordAcceptedFeedback
    this.votingSystem = votingSystem
    this.vibesById = new Map(vibes.map(vibe => [vibe.id, vibe]))
  }

  private readonly recordAcceptedFeedback?: FeedbackRecorder

  createOrResume(requestedSessionId?: string): SessionSnapshot {
    if (requestedSessionId) {
      const feedback = this.feedbackBySession.get(requestedSessionId)
      if (feedback) {
        return toSnapshot(requestedSessionId, feedback, this.completedSessionIds.has(requestedSessionId))
      }
    }

    const sessionId = randomBytes(24).toString("base64url")
    this.feedbackBySession.set(sessionId, new Map())
    this.feedbackEventCountsBySession.set(sessionId, new Map())
    return { feedback: {}, isComplete: false, sessionId }
  }

  /**
   * Upserts one Vibe response after journaling it. A matching retry is idempotent;
   * a changed response deliberately replaces the earlier opinion.
   */
  async recordFeedback(sessionId: string, vibeId: string, feedback: Feedback): Promise<SessionSnapshot> {
    const sessionFeedback = this.feedbackBySession.get(sessionId)
    if (!sessionFeedback) {
      throw new Error("Unknown review session. Reload the review page to start again.")
    }

    const vibe = this.vibesById.get(vibeId)
    if (!vibe) {
      throw new Error("Unknown vibe.")
    }

    if (!isFeedbackForVotingSystem(feedback, this.votingSystem)) {
      throw new Error(`Feedback must match the ${this.votingSystem} voting system.`)
    }

    const existingFeedback = sessionFeedback.get(vibeId)
    if (feedbackEqual(existingFeedback, feedback)) {
      return toSnapshot(sessionId, sessionFeedback, this.completedSessionIds.has(sessionId))
    }

    // Write a durable event before making the accepted feedback visible to the client.
    const event = this.nextFeedbackEvent(sessionId, vibeId)
    await this.recordAcceptedFeedback?.({
      eventId: event.id,
      feedback,
      sessionId,
      vibe: {
        file: vibe.file,
        id: vibe.id,
        label: vibe.label,
      },
    })
    this.feedbackEventCountsBySession.get(sessionId)?.set(vibeId, event.sequence)
    sessionFeedback.set(vibeId, feedback)
    return toSnapshot(sessionId, sessionFeedback, this.completedSessionIds.has(sessionId))
  }

  getSession(sessionId: string): SessionSnapshot {
    const feedback = this.feedbackBySession.get(sessionId)
    if (!feedback) {
      throw new Error("Unknown review session. Reload the review page to start again.")
    }

    return toSnapshot(sessionId, feedback, this.completedSessionIds.has(sessionId))
  }

  /** Marks a queue traversal as complete even when the reviewer skipped some Vibes. */
  completeSession(sessionId: string): SessionSnapshot {
    const feedback = this.feedbackBySession.get(sessionId)
    if (!feedback) {
      throw new Error("Unknown review session. Reload the review page to start again.")
    }

    this.completedSessionIds.add(sessionId)
    return toSnapshot(sessionId, feedback, true)
  }

  /** Returns the current non-empty comments in stable Vibe and session order. */
  comments(): readonly CommentLog[] {
    if (this.votingSystem !== "comment") return []

    return this.vibes.flatMap(vibe =>
      Array.from(this.feedbackBySession.entries()).flatMap(([sessionId, feedback]) => {
        const response = feedback.get(vibe.id)
        const comment = response?.kind === "comment" ? response.comment.trim() : ""
        return comment ? [{ comment, sessionId, vibe: { file: vibe.file, id: vibe.id, label: vibe.label } }] : []
      })
    )
  }

  results(): readonly ResultRow[] {
    switch (this.votingSystem) {
      case "tinder":
        return this.vibes.map(vibe => this.tinderResult(vibe)).sort(compareTinderResultRows)
      case "stars":
        return this.vibes.map(vibe => this.starResult(vibe)).sort(compareStarResultRows)
      case "comment":
        return this.vibes.map(vibe => this.commentResult(vibe))
    }
  }

  private tinderResult(vibe: RenderedVibe): TinderResultRow {
    let keepCount = 0
    let loveCount = 0

    for (const feedback of this.feedbackBySession.values()) {
      const response = feedback.get(vibe.id)
      if (response?.kind !== "tinder") continue
      if (response.vote === "keep" || response.vote === "love") keepCount += 1
      if (response.vote === "love") loveCount += 1
    }

    return { file: vibe.file, id: vibe.id, keepCount, label: vibe.label, loveCount }
  }

  private starResult(vibe: RenderedVibe): StarResultRow {
    let ratingCount = 0
    let totalRating = 0

    for (const feedback of this.feedbackBySession.values()) {
      const response = feedback.get(vibe.id)
      if (response?.kind !== "stars") continue
      ratingCount += 1
      totalRating += response.rating
    }

    return {
      averageRating: ratingCount === 0 ? null : totalRating / ratingCount,
      file: vibe.file,
      id: vibe.id,
      label: vibe.label,
      ratingCount,
      votingSystem: "stars",
    }
  }

  private commentResult(vibe: RenderedVibe): CommentResultRow {
    let commentCount = 0

    for (const feedback of this.feedbackBySession.values()) {
      const response = feedback.get(vibe.id)
      if (response?.kind === "comment" && response.comment.trim()) commentCount += 1
    }

    return { commentCount, file: vibe.file, id: vibe.id, label: vibe.label, votingSystem: "comment" }
  }

  /**
   * Allocates a stable retry key without advancing it until journaling succeeds.
   * A changed response receives a new event so replay preserves its final value.
   */
  private nextFeedbackEvent(sessionId: string, vibeId: string): { id: string; sequence: number } {
    const sequence = (this.feedbackEventCountsBySession.get(sessionId)?.get(vibeId) ?? 0) + 1
    return { id: `${sessionId}:${vibeId}:${sequence}`, sequence }
  }
}

function toSnapshot(sessionId: string, feedback: ReadonlyMap<string, Feedback>, isComplete: boolean): SessionSnapshot {
  return {
    feedback: Object.fromEntries(feedback),
    isComplete,
    sessionId,
  }
}

function feedbackEqual(left: Feedback | undefined, right: Feedback): boolean {
  if (!left || left.kind !== right.kind) return false
  if (left.kind === "tinder" && right.kind === "tinder") return left.vote === right.vote
  if (left.kind === "stars" && right.kind === "stars") return left.rating === right.rating
  return left.kind === "comment" && right.kind === "comment" && left.comment === right.comment
}

// Rank aggregate Tinder results by Loves, then Keeps, with lexical tie-breaks for stable output.
function compareTinderResultRows(left: TinderResultRow, right: TinderResultRow): number {
  if (left.loveCount !== right.loveCount) return right.loveCount - left.loveCount
  if (left.keepCount !== right.keepCount) return right.keepCount - left.keepCount
  return compareVibes(left, right)
}

// Rank star results by average rating, then the number of ratings, with stable lexical ties.
function compareStarResultRows(left: StarResultRow, right: StarResultRow): number {
  if (left.averageRating === null) return right.averageRating === null ? compareStarRatingCounts(left, right) : 1
  if (right.averageRating === null) return -1
  if (left.averageRating !== right.averageRating) return right.averageRating - left.averageRating
  return compareStarRatingCounts(left, right)
}

function compareStarRatingCounts(left: StarResultRow, right: StarResultRow): number {
  if (left.ratingCount !== right.ratingCount) return right.ratingCount - left.ratingCount
  return compareVibes(left, right)
}

function compareVibes(left: Pick<ResultRow, "file" | "label">, right: Pick<ResultRow, "file" | "label">): number {
  if (left.label !== right.label) return left.label < right.label ? -1 : 1
  if (left.file !== right.file) return left.file < right.file ? -1 : 1
  return 0
}
