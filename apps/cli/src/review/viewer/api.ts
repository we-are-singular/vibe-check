import type { ResultRow, SessionSnapshot, Vote } from "../../types.js"
import { getErrorMessage } from "../../utils.js"

/** Candidate metadata exposed to the browser; preview content stays server-side. */
export type CampaignVibe = {
  file: string
  id: string
  label: string
}

/** Campaign metadata returned by the review API. */
export type Campaign = {
  title: string
  vibes: readonly CampaignVibe[]
}

/** Browser-facing alias for the server's session verdict snapshot. */
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

  async recordVote(input: { sessionId: string; vibeId: string; vote: Vote }): Promise<ReviewSession> {
    return this.getJson<ReviewSession>("/api/votes", {
      body: JSON.stringify(input),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  }

  async getResults(sessionId: string): Promise<readonly ResultRow[]> {
    const search = new URLSearchParams({ sessionId })
    return (await this.getJson<{ results: readonly ResultRow[] }>(`/api/results?${search.toString()}`)).results
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
