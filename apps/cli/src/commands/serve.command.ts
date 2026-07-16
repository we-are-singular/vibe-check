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
    description: "Serve self-contained HTML or Markdown files for shared feedback",
    details:
      "Requires two or more direct-child `.html`, `.md`, or `.markdown` candidates; HTML and Markdown may be mixed, files are reviewed in lexical filename order, and HTML must be self-contained. Starts a review URL on your machine; `--tunnel` shares it. Markdown frontmatter renders as metadata. Feedback exists only while this process runs. Stop gracefully with SIGINT or SIGTERM to print the final session summary; `--output` mirrors lifecycle output to a file. Cloudflare requires `cloudflared`; ngrok requires an installed, authenticated ngrok client.",
    examples: [
      ["Start a feedback session", "vibe-check serve ./candidate-variants"],
      ["Use another port", "vibe-check serve ./candidate-variants --port 4214"],
      ["Emit JSON lifecycle events", "vibe-check serve ./candidate-variants --json"],
      ["Write lifecycle output to a file", "vibe-check serve ./candidate-variants --json --output vibe-check.log"],
      ["Share through Cloudflare", "vibe-check serve ./candidate-variants --tunnel cloudflare"],
    ],
  })

  directory = Option.String()

  port = Option.String("--port", {
    description: "Loopback port (1-65535, default: 4173)",
    required: false,
  })

  outputPath = Option.String("--output", {
    description: "Mirror CLI lifecycle output to a file (replaces an existing file)",
    required: false,
  })

  tunnel = Option.String("--tunnel", {
    description: `Temporary public tunnel provider (${TUNNEL_PROVIDERS.join(", ")}; see details for prerequisites)`,
    required: false,
  })

  async execute(): Promise<number> {
    try {
      if (this.outputPath !== undefined) await this.openOutputFile(this.outputPath)
    } catch (error) {
      await this.output({ type: "error", message: `unable to create output file: ${getErrorMessage(error)}` })
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
      const port = parsePort(this.port ?? "4173")
      if (port === null) {
        await this.output({ type: "error", message: "--port must be a base-10 integer from 1 through 65535." })
        return 1
      }

      const tunnelProvider = TUNNEL_PROVIDERS.find(provider => provider === this.tunnel)
      if (this.tunnel !== undefined && tunnelProvider === undefined) {
        await this.output({ type: "error", message: `--tunnel must be one of: ${TUNNEL_PROVIDERS.join(", ")}.` })
        return 1
      }

      const campaign = await new CampaignLoader([new HtmlFragmentRenderer(), new MarkdownRenderer()]).load(
        this.directory
      )
      const voteStore = new InMemoryVoteStore(campaign.vibes, vote => this.output({ type: "vote", ...vote }))
      server = new Server(campaign, voteStore)
      const reviewUrl = (await server.start(port)).url
      activeTunnel = tunnelProvider === undefined ? undefined : await startTunnel(tunnelProvider, reviewUrl)

      await this.output({
        type: "started",
        campaign: {
          directory: campaign.directory,
          title: campaign.title,
          vibeCount: campaign.vibes.length,
        },
        hint:
          activeTunnel === undefined
            ? "Review is ready. Press Ctrl+C to stop and print the final session summary."
            : `Shared feedback is available through ${tunnelProvider}: anyone with the public URL can participate. Press Ctrl+C to stop and print the final session summary.`,
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

      await this.output({
        type: "stopped",
        hint:
          tunnelProvider === undefined
            ? "Vibe Check stopped. The session is no longer available."
            : `${tunnelProvider} tunnel closed. Vibe Check stopped. The session is no longer available.`,
        results: voteStore.results(),
      })
      return 0
    } catch (error) {
      await stopResources()
      await this.output({ type: "error", message: `unable to serve campaign: ${getErrorMessage(error)}` })
      return 1
    } finally {
      await this.closeOutputFile()
    }
  }
}

function parsePort(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null

  const port = Number(value)
  return Number.isSafeInteger(port) && port <= 65_535 ? port : null
}
