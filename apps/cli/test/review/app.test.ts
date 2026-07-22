import type { Hono } from "hono"
import { Buffer } from "node:buffer"

import type { Campaign } from "../../src/campaign/campaign-loader.js"
import { InMemoryFeedbackStore } from "../../src/review/in-memory-feedback-store.js"
import { createReviewApp } from "../../src/review/app.js"
import type { ViewerAssetSource } from "../../src/review/viewer-assets.js"
import type { VotingSystem } from "../../src/types.js"

function createTestApp(votingSystem: VotingSystem = "love", viewerAssetsOverride?: ViewerAssetSource) {
  const campaign = {
    directory: "/campaign",
    title: "Which draft should we ship?",
    vibes: [
      {
        file: "plain.html",
        id: "html-vibe",
        label: "Plain HTML",
        preview: {
          content: "<!doctype html><html><body><h1>HTML candidate</h1></body></html>",
          kind: "html",
        },
      },
      {
        file: "brief.md",
        id: "markdown-vibe",
        label: "Markdown brief",
        preview: {
          content: "<h1>Markdown candidate</h1><p>Safe prose.</p>",
          kind: "markdown",
          metadata: {},
        },
      },
    ],
  } satisfies Campaign

  const viewerAssets: ViewerAssetSource = viewerAssetsOverride ?? {
    async asset(pathname) {
      if (pathname !== "app.js") return null
      return {
        body: Buffer.from("console.log('viewer')"),
        contentType: "text/javascript; charset=utf-8",
      }
    },
    async indexHtml() {
      return '<!doctype html><html><body><div id="root"></div></body></html>'
    },
  }

  return createReviewApp({
    campaign,
    feedbackStore: new InMemoryFeedbackStore(campaign.vibes, { votingSystem }),
    viewerAssets,
  })
}

async function createSession(app: Hono): Promise<{ sessionId: string }> {
  const response = await app.request("/api/session", {
    body: "{}",
    headers: { "content-type": "application/json" },
    method: "POST",
  })
  expect(response.status).toBe(200)
  return (await response.json()) as { sessionId: string }
}

describe("createReviewApp", () => {
  it("serves the viewer and renders Markdown previews through the isolated document route", async () => {
    const app = createTestApp()

    const viewer = await app.request("/")
    expect(viewer.status).toBe(200)
    expect(viewer.headers.get("content-security-policy")).toContain("frame-src 'self'")
    expect(viewer.headers.get("cache-control")).toBe("no-store")
    expect(await viewer.text()).toContain('id="root"')

    const campaign = await app.request("/api/campaign")
    await expect(campaign.json()).resolves.toMatchObject({
      title: "Which draft should we ship?",
      vibes: [{ kind: "html" }, { kind: "markdown" }],
      votingSystem: "love",
    })

    const asset = await app.request("/viewer-assets/app.js")
    expect(asset.status).toBe(200)
    expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
    expect(await asset.text()).toContain("console.log")

    const preview = await app.request("/vibes/markdown-vibe")
    expect(preview.status).toBe(200)
    expect(preview.headers.get("content-security-policy")).toContain("default-src 'none'")
    const previewHtml = await preview.text()
    expect(previewHtml).toContain('<!doctype html><html lang="en"')
    expect(previewHtml).toContain("<h1>Markdown candidate</h1><p>Safe prose.</p>")
  })

  it("preserves default Love results while allowing a changed verdict", async () => {
    const app = createTestApp()
    const session = await createSession(app)

    const unansweredResults = await app.request(`/api/results?sessionId=${session.sessionId}`)
    expect(unansweredResults.status).toBe(200)
    await expect(unansweredResults.json()).resolves.toMatchObject({
      results: [
        { id: "markdown-vibe", keepCount: 0, loveCount: 0 },
        { id: "html-vibe", keepCount: 0, loveCount: 0 },
      ],
    })

    for (const [vibeId, feedback] of [
      ["html-vibe", { kind: "love", vote: "love" }],
      ["html-vibe", { kind: "love", vote: "keep" }],
      ["markdown-vibe", { kind: "love", vote: "keep" }],
    ] as const) {
      const response = await app.request("/api/feedback", {
        body: JSON.stringify({ feedback, sessionId: session.sessionId, vibeId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
      expect(response.status).toBe(200)
    }

    const resultsResponse = await app.request(`/api/results?sessionId=${session.sessionId}`)
    expect(resultsResponse.status).toBe(200)
    await expect(resultsResponse.json()).resolves.toEqual({
      results: [
        {
          file: "brief.md",
          id: "markdown-vibe",
          keepCount: 1,
          label: "Markdown brief",
          loveCount: 0,
        },
        {
          file: "plain.html",
          id: "html-vibe",
          keepCount: 1,
          label: "Plain HTML",
          loveCount: 0,
        },
      ],
    })
  })

  it("persists completion through the session API", async () => {
    const app = createTestApp()
    const session = await createSession(app)

    const completed = await app.request("/api/session/complete", {
      body: JSON.stringify({ sessionId: session.sessionId }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    expect(completed.status).toBe(200)
    await expect(completed.json()).resolves.toMatchObject({ isComplete: true, sessionId: session.sessionId })

    const resumed = await app.request("/api/session", {
      body: JSON.stringify({ sessionId: session.sessionId }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    await expect(resumed.json()).resolves.toMatchObject({ isComplete: true, sessionId: session.sessionId })
  })

  it("validates and aggregates star ratings", async () => {
    const app = createTestApp("stars")
    const session = await createSession(app)

    const invalid = await app.request("/api/feedback", {
      body: JSON.stringify({
        feedback: { kind: "stars", rating: 6 },
        sessionId: session.sessionId,
        vibeId: "html-vibe",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    expect(invalid.status).toBe(400)

    for (const [vibeId, rating] of [
      ["html-vibe", 4],
      ["markdown-vibe", 5],
    ] as const) {
      const response = await app.request("/api/feedback", {
        body: JSON.stringify({ feedback: { kind: "stars", rating }, sessionId: session.sessionId, vibeId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
      expect(response.status).toBe(200)
    }

    const results = await app.request(`/api/results?sessionId=${session.sessionId}`)
    await expect(results.json()).resolves.toMatchObject({
      results: [
        { averageRating: 5, id: "markdown-vibe", ratingCount: 1, votingSystem: "stars" },
        { averageRating: 4, id: "html-vibe", ratingCount: 1, votingSystem: "stars" },
      ],
    })
  })

  it("returns comment results even when some Vibes have no response", async () => {
    const app = createTestApp("comment")
    const session = await createSession(app)

    const response = await app.request("/api/feedback", {
      body: JSON.stringify({
        feedback: { comment: "Clear hierarchy.", kind: "comment" },
        sessionId: session.sessionId,
        vibeId: "html-vibe",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    expect(response.status).toBe(200)

    const results = await app.request(`/api/results?sessionId=${session.sessionId}`)
    await expect(results.json()).resolves.toMatchObject({
      results: [
        { commentCount: 1, id: "html-vibe", votingSystem: "comment" },
        { commentCount: 0, id: "markdown-vibe", votingSystem: "comment" },
      ],
    })
  })

  it("rejects malformed and oversized JSON input", async () => {
    const app = createTestApp()

    const malformed = await app.request("/api/session", {
      body: "{",
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    expect(malformed.status).toBe(400)
    await expect(malformed.json()).resolves.toEqual({ error: "Request body must be valid JSON." })

    const oversized = await app.request("/api/session", {
      body: JSON.stringify({ sessionId: "x".repeat(32 * 1024) }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    expect(oversized.status).toBe(413)
    await expect(oversized.json()).resolves.toEqual({ error: "Request body exceeds 32 KiB." })
  })

  it("keeps viewer asset failures separate from malformed request JSON", async () => {
    const app = createTestApp("love", {
      async asset() {
        throw new SyntaxError("manifest is malformed")
      },
      async indexHtml() {
        return "<!doctype html>"
      },
    })

    const response = await app.request("/viewer-assets/markdown.css")

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Unexpected review server error." })
  })
})
