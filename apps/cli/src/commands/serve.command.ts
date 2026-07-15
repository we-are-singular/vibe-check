import { Command, Option } from "clipanion"
import { CampaignLoader } from "../campaign/campaign-loader.js"
import { HtmlFragmentRenderer } from "../campaign/renderers/html-fragment-renderer.js"
import { MarkdownRenderer } from "../campaign/renderers/markdown-renderer.js"
import { VibeCheckCommand } from "../vibe-check-command.js"
import { InMemoryVoteStore } from "../review/in-memory-vote-store.js"
import { Server } from "../review/server.js"
import { startTunnel, TUNNEL_PROVIDERS, type ActiveTunnel } from "../tunnel/tunnel.js"
import { getErrorMessage } from "../utils.js"

/** Starts the intentionally ephemeral local HTML review POC. */
export class ServeCommand extends VibeCheckCommand {
  static paths = [["serve"]]

  static usage = Command.Usage({
    description: "Serve a folder of self-contained HTML or Markdown vibes for local voting",
    details:
      "Loads direct-child HTML and Markdown files, renders one sandboxed candidate at a time, and keeps votes only while this process runs.",
    examples: [["Review a candidate folder", "vibe-check serve ./candidate-variants"]],
  })

  directory = Option.String()

  port = Option.String("--port", {
    description: "Loopback port (1-65535, default: 4173)",
    required: false,
  })

  tunnel = Option.String("--tunnel", {
    description: `Temporary public tunnel provider (${TUNNEL_PROVIDERS.join(", ")})`,
    required: false,
  })

  async execute(): Promise<number> {
    const port = parsePort(this.port ?? "4173")
    if (port === null) {
      this.output({ type: "error", message: "--port must be a base-10 integer from 1 through 65535." })
      return 1
    }

    const tunnelProvider = TUNNEL_PROVIDERS.find(provider => provider === this.tunnel)
    if (this.tunnel !== undefined && tunnelProvider === undefined) {
      this.output({ type: "error", message: `--tunnel must be one of: ${TUNNEL_PROVIDERS.join(", ")}.` })
      return 1
    }

    let server: Server | undefined
    let activeTunnel: ActiveTunnel | undefined
    const stopResources = async () => {
      const tunnel = activeTunnel
      activeTunnel = undefined
      try {
        await tunnel?.stop()
      } finally {
        await server?.stop()
      }
    }

    try {
      const campaign = await new CampaignLoader([new HtmlFragmentRenderer(), new MarkdownRenderer()]).load(
        this.directory
      )
      const voteStore = new InMemoryVoteStore(campaign.vibes)
      server = new Server(campaign, voteStore)
      const reviewUrl = (await server.start(port)).url
      activeTunnel = tunnelProvider === undefined ? undefined : await startTunnel(tunnelProvider, reviewUrl)

      this.output({
        type: "started",
        campaign: {
          directory: campaign.directory,
          title: campaign.title,
          vibeCount: campaign.vibes.length,
        },
        hint:
          activeTunnel === undefined
            ? "Press Ctrl+C to stop. Votes are stored only in memory and will be discarded."
            : `Public anonymous voting is active through ${tunnelProvider}: anyone with the public URL can vote. Press Ctrl+C to stop.`,
        urls: {
          apiResults: `${reviewUrl}/api/results?sessionId=<session-id>`,
          public: activeTunnel?.publicUrl,
          results: `${reviewUrl}/results`,
          review: reviewUrl,
        },
      })

      const { promise, reject, resolve } = Promise.withResolvers<void>()
      const stop = () => {
        process.off("SIGINT", stop)
        process.off("SIGTERM", stop)
        void stopResources().then(resolve, reject)
      }

      process.once("SIGINT", stop)
      process.once("SIGTERM", stop)
      await promise

      this.output({
        type: "stopped",
        hint:
          tunnelProvider === undefined
            ? "Vibe Check stopped. In-memory votes were discarded."
            : `${tunnelProvider} tunnel closed. Vibe Check stopped. In-memory votes were discarded.`,
        results: voteStore.results(),
      })
      return 0
    } catch (error) {
      await stopResources()
      this.output({ type: "error", message: `unable to serve campaign: ${getErrorMessage(error)}` })
      return 1
    }
  }
}

function parsePort(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null

  const port = Number(value)
  return Number.isSafeInteger(port) && port <= 65_535 ? port : null
}
