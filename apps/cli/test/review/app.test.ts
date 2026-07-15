import { Buffer } from "node:buffer"
import { describe, expect, it } from "vitest"
import type { Campaign } from "../../src/campaign/campaign-loader.js"
import { InMemoryVoteStore } from "../../src/review/in-memory-vote-store.js"
import { createReviewApp } from "../../src/review/app.js"
import type { ViewerAssetSource } from "../../src/review/viewer-assets.js"

function createTestApp(viewerAssetsOverride?: ViewerAssetSource) {
  const campaign = {
    directory: "/campaign",
    title: "Campaign",
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
    viewerAssets,
    voteStore: new InMemoryVoteStore(campaign.vibes),
  })
}

describe("createReviewApp", () => {
  it("serves the viewer and renders Markdown previews through the isolated document route", async () => {
    const app = createTestApp()

    const viewer = await app.request("/")
    expect(viewer.status).toBe(200)
    expect(viewer.headers.get("content-security-policy")).toContain("frame-src 'self'")
    expect(viewer.headers.get("cache-control")).toBe("no-store")
    expect(await viewer.text()).toContain('id="root"')

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

  it("preserves vote and results contracts", async () => {
    const app = createTestApp()
    const sessionResponse = await app.request("/api/session", {
      body: "{}",
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    const session = (await sessionResponse.json()) as { sessionId: string }

    expect(sessionResponse.status).toBe(200)
    expect(session.sessionId).toHaveLength(32)

    const incompleteResults = await app.request(`/api/results?sessionId=${session.sessionId}`)
    expect(incompleteResults.status).toBe(409)
    await expect(incompleteResults.json()).resolves.toMatchObject({
      completedVibes: 0,
      totalVibes: 2,
    })

    for (const [vibeId, vote] of [
      ["html-vibe", "love"],
      ["markdown-vibe", "keep"],
    ] as const) {
      const voteResponse = await app.request("/api/votes", {
        body: JSON.stringify({ sessionId: session.sessionId, vibeId, vote }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
      expect(voteResponse.status).toBe(200)
    }

    const resultsResponse = await app.request(`/api/results?sessionId=${session.sessionId}`)
    expect(resultsResponse.status).toBe(200)
    await expect(resultsResponse.json()).resolves.toEqual({
      results: [
        {
          file: "plain.html",
          id: "html-vibe",
          keepCount: 1,
          label: "Plain HTML",
          loveCount: 1,
        },
        {
          file: "brief.md",
          id: "markdown-vibe",
          keepCount: 1,
          label: "Markdown brief",
          loveCount: 0,
        },
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
    const app = createTestApp({
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
