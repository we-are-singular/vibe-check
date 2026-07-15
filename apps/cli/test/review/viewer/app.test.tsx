// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost"}

import { cleanup, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { ReviewApiClient, type Campaign, type ReviewSession } from "../../../src/review/viewer/api.js"
import type { ResultRow, Vote } from "../../../src/types.js"
import { ViewerApp } from "../../../src/review/viewer/app.js"

const campaign: Campaign = {
  title: "Launch contenders",
  vibes: [{ file: "aurora.html", id: "aurora", label: "Aurora" }],
}

const results: readonly ResultRow[] = [
  {
    file: "aurora.html",
    id: "aurora",
    keepCount: 3,
    label: "Aurora",
    loveCount: 2,
  },
]

class FakeReviewApiClient extends ReviewApiClient {
  readonly recordedVotes: Array<{ sessionId: string; vibeId: string; vote: Vote }> = []

  override async getCampaign(): Promise<Campaign> {
    return campaign
  }

  override async createOrResumeSession(): Promise<ReviewSession> {
    return { sessionId: "session-1", votes: {} }
  }

  override async recordVote(input: { sessionId: string; vibeId: string; vote: Vote }): Promise<ReviewSession> {
    this.recordedVotes.push(input)
    return { sessionId: input.sessionId, votes: { [input.vibeId]: input.vote } }
  }

  override async getResults(sessionId: string): Promise<readonly ResultRow[]> {
    if (sessionId !== "session-1") throw new Error("Unexpected session")
    return results
  }
}

describe("ViewerApp", () => {
  afterEach(() => {
    cleanup()
  })

  it("posts a Love from the heart action and presents heart Loves with numeric Keeps", async () => {
    const api = new FakeReviewApiClient()
    const user = userEvent.setup()

    render(<ViewerApp api={api} />)

    await user.click(await screen.findByRole("button", { name: "I love it" }))

    await screen.findByRole("heading", { name: "Results" })
    expect(api.recordedVotes).toEqual([{ sessionId: "session-1", vibeId: "aurora", vote: "love" }])

    const loves = screen.getByLabelText("2 loves")
    expect(loves.textContent).toBe("❤️❤️")
    expect(screen.getByLabelText("3 keeps").textContent).toBe("3")
  })
})
