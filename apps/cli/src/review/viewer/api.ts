import type { Feedback, SessionSnapshot, VibePreview, VotingSystem } from "../../types.js"
import { getErrorMessage } from "../../utils.js"

/** Candidate metadata exposed to the browser; preview content stays server-side. */
export type CampaignVibe = {
  file: string
  id: string
  kind: VibePreview["kind"]
  label: string
}

/** Campaign metadata returned by the review API. */
export type Campaign = {
  title: string
  vibes: readonly CampaignVibe[]
  votingSystem: VotingSystem
}

/** Browser-facing alias for the server's session feedback snapshot. */
export type ReviewSession = SessionSnapshot

/** Calls the review HTTP API from the bundled browser viewer. */
export class ReviewApiClient {
  constructor(private readonly request = globalThis.fetch.bind(globalThis)) {}

  async getCampaign(): Promise<Campaign> {
    return this.getJson<Campaign>("/api/campaign")
  }

  async createOrResumeSession(sessionId?: string): Promise<ReviewSession> {
    return this.getJson<ReviewSession>("/api/session", {
      body: JSON.stringify(sessionId ? { sessionId } : {}),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  }

  async recordFeedback(input: { feedback: Feedback; sessionId: string; vibeId: string }): Promise<ReviewSession> {
    return this.getJson<ReviewSession>("/api/feedback", {
      body: JSON.stringify(input),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  }

  async completeSession(sessionId: string): Promise<ReviewSession> {
    return this.getJson<ReviewSession>("/api/session/complete", {
      body: JSON.stringify({ sessionId }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  }

  private async getJson<T>(path: string, init?: RequestInit): Promise<T> {
    try {
      const response = await this.request(path, init)
      const body = await response.json()
      if (!response.ok) throw new Error(getErrorMessage(body))
      return body as T
    } catch (error) {
      throw new Error(getErrorMessage(error), { cause: error })
    }
  }
}
