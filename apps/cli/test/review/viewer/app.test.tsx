// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost"}

import { cleanup, render, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { ReviewApiClient, type Campaign, type ReviewSession } from "../../../src/review/viewer/api.js"
import type { Feedback } from "../../../src/types.js"
import { ViewerApp } from "../../../src/review/viewer/app.js"

const loveCampaign: Campaign = {
  title: "Launch contenders",
  vibes: [
    { file: "aurora.html", id: "aurora", kind: "html", label: "Aurora" },
    { file: "beacon.html", id: "beacon", kind: "html", label: "Beacon" },
  ],
  votingSystem: "love",
}

const localStorageValues = new Map<string, string>()

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => localStorageValues.clear(),
      getItem: (key: string) => localStorageValues.get(key) ?? null,
      removeItem: (key: string) => localStorageValues.delete(key),
      setItem: (key: string, value: string) => localStorageValues.set(key, value),
    },
  })
})

class FakeReviewApiClient extends ReviewApiClient {
  readonly recordedFeedback: Array<{ feedback: Feedback; sessionId: string; vibeId: string }> = []
  private session: ReviewSession = { feedback: {}, isComplete: false, sessionId: "session-1" }

  constructor(private readonly campaign: Campaign) {
    super()
  }

  override async getCampaign(): Promise<Campaign> {
    return this.campaign
  }

  override async createOrResumeSession(): Promise<ReviewSession> {
    return this.session
  }

  override async recordFeedback(input: {
    feedback: Feedback
    sessionId: string
    vibeId: string
  }): Promise<ReviewSession> {
    this.recordedFeedback.push(input)
    this.session = {
      feedback: { ...this.session.feedback, [input.vibeId]: input.feedback },
      isComplete: this.session.isComplete,
      sessionId: input.sessionId,
    }
    return this.session
  }

  override async completeSession(sessionId: string): Promise<ReviewSession> {
    if (sessionId !== this.session.sessionId) throw new Error("Unexpected session")
    this.session = { ...this.session, isComplete: true }
    return this.session
  }
}

function getBottomQueueButton(name: "Finish review" | "Next Vibe" | "Previous Vibe"): HTMLElement {
  const buttons = screen.getAllByRole("button", { name })
  const button = buttons.at(-1)
  if (!button) throw new Error(`Missing bottom ${name} button.`)
  return button
}

function getHeaderGithubLink(): HTMLElement {
  const link = within(screen.getByRole("banner")).getByRole("link", { name: "Open Vibe Check on GitHub" })

  expect(link.getAttribute("href")).toBe("https://github.com/we-are-singular/vibe-check")
  expect(link.getAttribute("target")).toBe("_blank")
  expect(link.getAttribute("rel")).toBe("noopener noreferrer")

  return link
}

describe("ViewerApp", () => {
  afterEach(() => {
    cleanup()
    window.history.replaceState({}, "", "/")
    localStorageValues.clear()
  })

  it("renders a thank-you screen at the results route without starting another review", async () => {
    window.history.replaceState({}, "", "/results")
    const api = new FakeReviewApiClient(loveCampaign)

    render(<ViewerApp api={api} />)

    await screen.findByRole("heading", { name: "Thanks for sharing your perspective." })
    expect(screen.queryByTitle("Aurora")).toBeNull()
    expect(screen.getByRole("link", { name: "Star Us on GitHub" }).getAttribute("href")).toBe(
      "https://github.com/we-are-singular/vibe-check"
    )
    expect(screen.getByRole("link", { name: "Visit Vibe Check" }).getAttribute("href")).toBe(
      "https://vibe-check.wearesingular.com/"
    )
    getHeaderGithubLink()
  })
  it("advances after a Love verdict and preserves a revised opinion when returning", async () => {
    const api = new FakeReviewApiClient(loveCampaign)
    const user = userEvent.setup()

    render(<ViewerApp api={api} />)

    getHeaderGithubLink()
    await screen.findByTitle("Aurora")
    await user.click(screen.getByRole("button", { name: "Pass this Vibe" }))
    await screen.findByTitle("Beacon")

    await user.click(getBottomQueueButton("Previous Vibe"))
    await screen.findByTitle("Aurora")
    expect(screen.getByRole("button", { name: "Pass this Vibe" }).getAttribute("aria-pressed")).toBe("true")

    await user.click(screen.getByRole("button", { name: "I love it" }))
    await screen.findByTitle("Beacon")
    await user.click(screen.getByRole("button", { name: "Keep this Vibe" }))
    await screen.findByRole("heading", { name: "Thanks for sharing your perspective." })

    expect(api.recordedFeedback).toEqual([
      { feedback: { kind: "love", vote: "pass" }, sessionId: "session-1", vibeId: "aurora" },
      { feedback: { kind: "love", vote: "love" }, sessionId: "session-1", vibeId: "aurora" },
      { feedback: { kind: "love", vote: "keep" }, sessionId: "session-1", vibeId: "beacon" },
    ])
    expect(screen.getByText("npx skills add we-are-singular/vibe-check").textContent).toBe(
      "npx skills add we-are-singular/vibe-check"
    )
    expect(screen.getByRole("link", { name: "Star Us on GitHub" }).getAttribute("href")).toBe(
      "https://github.com/we-are-singular/vibe-check"
    )
    expect(screen.getByRole("link", { name: "Visit Vibe Check" }).getAttribute("href")).toBe(
      "https://vibe-check.wearesingular.com/"
    )
    getHeaderGithubLink()

    cleanup()
    render(<ViewerApp api={api} />)

    const header = screen.getByRole("banner")
    const reviewResponses = await within(header).findByRole("button", { name: "Review my responses" })
    const githubLink = getHeaderGithubLink()
    const helpButton = within(header).getByRole("button", { name: "How this review works" })
    const thankYouCard = screen.getByText("Keep the good vibes moving").closest("section")
    if (!thankYouCard) throw new Error("Missing thank-you card.")

    expect(reviewResponses).not.toBeNull()
    expect(helpButton).not.toBeNull()
    expect(reviewResponses.compareDocumentPosition(githubLink) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(githubLink.compareDocumentPosition(helpButton) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(within(header).getByRole("group", { name: "Preview width" }).hasAttribute("disabled")).toBe(true)
    expect(within(header).getByRole("button", { name: "Previous Vibe" }).hasAttribute("disabled")).toBe(true)
    expect(within(header).getByRole("button", { name: "Next Vibe" }).hasAttribute("disabled")).toBe(true)
    expect(within(header).queryByRole("button", { name: "Finish review" })).toBeNull()
    expect(within(thankYouCard).queryByRole("button", { name: "Review my responses" })).toBeNull()

    await user.click(reviewResponses)
    await screen.findByTitle("Aurora")
  })

  it("auto-advances after a star rating and keeps its cumulative highlight when returning", async () => {
    const campaign: Campaign = { ...loveCampaign, votingSystem: "stars" }
    const api = new FakeReviewApiClient(campaign)
    const user = userEvent.setup()

    render(<ViewerApp api={api} />)

    await screen.findByTitle("Aurora")
    await user.click(screen.getByRole("button", { name: "Rate this Vibe 4 stars" }))
    await screen.findByTitle("Beacon")
    await user.click(getBottomQueueButton("Previous Vibe"))

    expect(screen.getByRole("button", { name: "Rate this Vibe 1 star" }).getAttribute("data-lit")).toBe("true")
    expect(screen.getByRole("button", { name: "Rate this Vibe 4 stars" }).getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByRole("button", { name: "Rate this Vibe 5 stars" }).getAttribute("data-lit")).toBeNull()
  })

  it("renders Markdown at full width regardless of the saved HTML preview preference", async () => {
    const markdownCampaign: Campaign = {
      ...loveCampaign,
      vibes: [
        { file: "aurora.md", id: "aurora", kind: "markdown", label: "Aurora" },
        { file: "beacon.md", id: "beacon", kind: "markdown", label: "Beacon" },
      ],
      votingSystem: "stars",
    }
    window.localStorage.setItem("vibe-check:preview-width", "phone")
    const api = new FakeReviewApiClient(markdownCampaign)
    const user = userEvent.setup()

    render(<ViewerApp api={api} />)

    await screen.findByTitle("Aurora")
    expect(document.querySelector(".review-preview")?.getAttribute("data-preview-width")).toBe("full")
    expect(screen.queryByRole("group", { name: "Preview width" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "How this review works" }))
    expect(screen.getByRole("dialog").textContent).toContain("Star rating")
    expect(screen.getByRole("dialog").textContent).toContain("More lit stars means a stronger fit.")
    await user.click(screen.getByRole("button", { name: "Got it" }))
    await user.click(screen.getByRole("button", { name: "Rate this Vibe 4 stars" }))
    await screen.findByTitle("Beacon")
    await user.click(screen.getByRole("button", { name: "Rate this Vibe 4 stars" }))
    await screen.findByRole("heading", { name: "Thanks for sharing your perspective." })
    expect(screen.queryByRole("group", { name: "Preview width" })).toBeNull()
  })

  it("saves optional comments from Next and finishes after every Vibe", async () => {
    const campaign: Campaign = { ...loveCampaign, votingSystem: "comment" }
    const api = new FakeReviewApiClient(campaign)
    const user = userEvent.setup()

    render(<ViewerApp api={api} />)

    const comment = await screen.findByRole("textbox", { name: "Feedback for this Vibe" })
    await user.type(comment, "Clear hierarchy.")
    await user.click(getBottomQueueButton("Next Vibe"))
    await screen.findByTitle("Beacon")
    await user.click(getBottomQueueButton("Finish review"))
    await screen.findByRole("heading", { name: "Thanks for sharing your perspective." })

    expect(api.recordedFeedback).toEqual([
      { feedback: { comment: "Clear hierarchy.", kind: "comment" }, sessionId: "session-1", vibeId: "aurora" },
    ])
    expect(screen.queryByRole("heading", { name: "Results" })).toBeNull()
  })
})
