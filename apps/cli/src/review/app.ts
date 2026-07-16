import { Hono, type Context } from "hono"
import { bodyLimit } from "hono/body-limit"
import type { Campaign } from "../campaign/campaign-loader.js"
import { renderPreviewDocument } from "../campaign/renderers/preview-document.js"
import type { Vote } from "../types.js"
import { VOTE_VALUES } from "../types.js"
import { getErrorMessage, isRecord } from "../utils.js"
import type { InMemoryVoteStore } from "./in-memory-vote-store.js"
import { ViewerAssets, type ViewerAssetSource } from "./viewer-assets.js"

const MAX_JSON_BYTES = 32 * 1024
const VIEWER_CSP =
  "default-src 'self'; base-uri 'none'; connect-src 'self'; frame-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'"
const VIBE_CSP =
  "default-src 'none'; base-uri 'none'; form-action 'none'; font-src data:; img-src data:; script-src 'none'; style-src 'self' 'unsafe-inline'"

/** Dependencies supplied by the local Node host or a future portable runtime. */
export type ReviewAppDependencies = {
  readonly campaign: Campaign
  readonly voteStore: InMemoryVoteStore
  readonly viewerAssets?: ViewerAssetSource
}

/**
 * Creates the portable HTTP surface for one local Campaign review session.
 * Its host owns sockets and shutdown; this app owns routes and HTTP policy.
 */
export function createReviewApp({
  campaign,
  voteStore,
  viewerAssets = new ViewerAssets(),
}: ReviewAppDependencies): Hono {
  const vibeById = new Map(campaign.vibes.map(vibe => [vibe.id, vibe]))
  const app = new Hono()

  app.onError((error, context) => {
    if (error instanceof InvalidJsonRequestError) {
      return context.json({ error: "Request body must be valid JSON." }, 400)
    }

    return context.json({ error: "Unexpected review server error." }, 500)
  })

  app.notFound(context => context.text("Not found.", 404))

  // Every dynamic response is private; built viewer assets opt into immutable caching explicitly.
  app.use("*", async (context, next) => {
    await next()
    if (!context.res.headers.has("cache-control")) context.header("cache-control", "no-store")
  })

  app.use(
    "/api/*",
    bodyLimit({
      maxSize: MAX_JSON_BYTES,
      onError: context => context.json({ error: "Request body exceeds 32 KiB." }, 413),
    })
  )

  // Viewer document and allowlisted Vite output.
  app.get("/", async context => {
    context.header("cache-control", "no-store")
    context.header("content-security-policy", VIEWER_CSP)
    return context.html(await viewerAssets.indexHtml())
  })
  app.get("/results", async context => {
    context.header("cache-control", "no-store")
    context.header("content-security-policy", VIEWER_CSP)
    return context.html(await viewerAssets.indexHtml())
  })
  app.get("/viewer-assets/*", async context => {
    const asset = await viewerAssets.asset(context.req.path.slice("/viewer-assets/".length))
    if (!asset) {
      context.header("cache-control", "no-store")
      return context.text("Viewer asset not found.", 404)
    }

    // Node accepts Buffer response bodies even though browser DOM types omit them.
    return new Response(asset.body as unknown as BodyInit, {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-type": asset.contentType,
      },
    })
  })

  // Campaign and session API.
  app.get("/api/campaign", context => {
    context.header("cache-control", "no-store")
    return context.json({
      title: campaign.title,
      vibes: campaign.vibes.map(vibe => ({
        file: vibe.file,
        id: vibe.id,
        label: vibe.label,
      })),
    })
  })
  app.post("/api/session", async context => {
    const body = await parseJsonRequest(context)
    if (!isRecord(body) || (body.sessionId !== undefined && typeof body.sessionId !== "string")) {
      return context.json({ error: "sessionId must be a string when provided." }, 400)
    }

    context.header("cache-control", "no-store")
    return context.json(voteStore.createOrResume(body.sessionId))
  })
  app.post("/api/votes", async context => {
    const body = await parseJsonRequest(context)
    if (!isRecord(body) || typeof body.sessionId !== "string" || typeof body.vibeId !== "string") {
      return context.json({ error: "sessionId and vibeId are required strings." }, 400)
    }
    if (typeof body.vote !== "string" || !VOTE_VALUES.includes(body.vote as Vote)) {
      return context.json({ error: "vote must be pass, keep, or love." }, 400)
    }

    try {
      context.header("cache-control", "no-store")
      return context.json(await voteStore.recordVote(body.sessionId, body.vibeId, body.vote as Vote))
    } catch (error) {
      return context.json({ error: getErrorMessage(error) }, 409)
    }
  })
  app.get("/api/results", context => {
    const sessionId = context.req.query("sessionId")
    if (!sessionId) return context.json({ error: "sessionId is required." }, 400)

    try {
      const session = voteStore.getSession(sessionId)
      context.header("cache-control", "no-store")
      if (!voteStore.isComplete(sessionId)) {
        return context.json(
          {
            completedVibes: Object.keys(session.votes).length,
            error: "Vote on every vibe before viewing aggregate results.",
            totalVibes: campaign.vibes.length,
          },
          409
        )
      }

      return context.json({ results: voteStore.results() })
    } catch (error) {
      return context.json({ error: getErrorMessage(error) }, 409)
    }
  })

  // Sandboxed candidate preview documents.
  app.get("/vibes/:vibeId", context => {
    const vibe = vibeById.get(context.req.param("vibeId"))
    if (!vibe) {
      context.header("cache-control", "no-store")
      return context.text("Vibe not found.", 404)
    }

    context.header("cache-control", "no-store")
    context.header("content-security-policy", VIBE_CSP)
    return context.html(renderPreviewDocument(vibe))
  })

  return app
}

/** Distinguishes malformed API JSON from unrelated server-side SyntaxErrors. */
class InvalidJsonRequestError extends Error {}

async function parseJsonRequest(context: Context): Promise<unknown> {
  try {
    return await context.req.json()
  } catch {
    throw new InvalidJsonRequestError()
  }
}
