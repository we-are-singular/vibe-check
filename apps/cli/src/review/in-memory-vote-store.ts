import { randomBytes } from "node:crypto"
import type { RenderedVibe, ResultRow, SessionSnapshot, Vote } from "../types.js"
import { VOTE_VALUES } from "../types.js"

export type RecordedVote = {
  sessionId: string
  vibe: Pick<RenderedVibe, "file" | "id" | "label">
  vote: Vote
}

type VoteRecorder = (record: RecordedVote) => Promise<void>
/**
 * Process-local vote state for the POC. It intentionally disappears on restart;
 * durable local Campaign state is a later vertical slice.
 */
export class InMemoryVoteStore {
  private readonly sessions = new Map<string, Map<string, Vote>>()
  private readonly vibesById: ReadonlyMap<string, RenderedVibe>

  constructor(
    private readonly vibes: readonly RenderedVibe[],
    private readonly recordAcceptedVote?: VoteRecorder
  ) {
    this.vibesById = new Map(vibes.map(vibe => [vibe.id, vibe]))
  }

  createOrResume(requestedSessionId?: string): SessionSnapshot {
    if (requestedSessionId) {
      const votes = this.sessions.get(requestedSessionId)
      if (votes) {
        return toSnapshot(requestedSessionId, votes)
      }
    }

    const sessionId = randomBytes(24).toString("base64url")
    this.sessions.set(sessionId, new Map())
    return { sessionId, votes: {} }
  }

  async recordVote(sessionId: string, vibeId: string, vote: Vote): Promise<SessionSnapshot> {
    const votes = this.sessions.get(sessionId)
    if (!votes) {
      throw new Error("Unknown review session. Reload the review page to start again.")
    }

    const vibe = this.vibesById.get(vibeId)
    if (!vibe) {
      throw new Error("Unknown vibe.")
    }

    if (!VOTE_VALUES.includes(vote)) {
      throw new Error("Vote must be pass, keep, or love.")
    }

    const existingVote = votes.get(vibeId)
    if (existingVote) {
      if (existingVote !== vote) {
        throw new Error("A vote for this vibe was already recorded.")
      }

      return toSnapshot(sessionId, votes)
    }

    // Write a durable event before making the accepted vote visible to the client.
    await this.recordAcceptedVote?.({
      sessionId,
      vibe: {
        file: vibe.file,
        id: vibe.id,
        label: vibe.label,
      },
      vote,
    })
    votes.set(vibeId, vote)
    return toSnapshot(sessionId, votes)
  }

  getSession(sessionId: string): SessionSnapshot {
    const votes = this.sessions.get(sessionId)
    if (!votes) {
      throw new Error("Unknown review session. Reload the review page to start again.")
    }

    return toSnapshot(sessionId, votes)
  }

  isComplete(sessionId: string): boolean {
    const votes = this.sessions.get(sessionId)
    return votes !== undefined && votes.size === this.vibes.length
  }

  results(): readonly ResultRow[] {
    const rows = this.vibes.map(vibe => {
      let keepCount = 0
      let loveCount = 0

      for (const votes of this.sessions.values()) {
        const vote = votes.get(vibe.id)
        if (vote === "keep" || vote === "love") keepCount += 1
        if (vote === "love") loveCount += 1
      }

      return {
        file: vibe.file,
        id: vibe.id,
        keepCount,
        label: vibe.label,
        loveCount,
      }
    })

    return rows.sort(compareResultRows)
  }
}

function toSnapshot(sessionId: string, votes: ReadonlyMap<string, Vote>): SessionSnapshot {
  return {
    sessionId,
    votes: Object.fromEntries(votes),
  }
}

// Rank aggregate results by Loves, then Keeps, with lexical tie-breaks for stable output.
function compareResultRows(left: ResultRow, right: ResultRow): number {
  if (left.loveCount !== right.loveCount) return right.loveCount - left.loveCount
  if (left.keepCount !== right.keepCount) return right.keepCount - left.keepCount

  if (left.label !== right.label) return left.label < right.label ? -1 : 1
  if (left.file !== right.file) return left.file < right.file ? -1 : 1
  return 0
}
