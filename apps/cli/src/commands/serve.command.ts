import { Command, Option } from "clipanion"
import { CampaignLoader } from "../campaign/campaign-loader.js"
import { HtmlFragmentRenderer } from "../campaign/renderers/html-fragment-renderer.js"
import { MarkdownRenderer } from "../campaign/renderers/markdown-renderer.js"
import { VibeCheckCommand } from "../vibe-check-command.js"
import { InMemoryFeedbackStore } from "../review/in-memory-feedback-store.js"
import { Server } from "../review/server.js"
import { startTunnel, TUNNEL_PROVIDERS, type ActiveTunnel } from "../tunnel/tunnel.js"
import { getErrorMessage } from "../utils.js"
import { VOTING_SYSTEM_VALUES, type VotingSystem } from "../types.js"

/** Starts the intentionally ephemeral local HTML review POC. */
export class ServeCommand extends VibeCheckCommand {
  static paths = [["serve"]]

  static usage = Command.Usage({
    description: "Serve self-contained HTML or Markdown files for shared feedback",
    details: `
      Requires two or more direct-child \`.html\`, \`.md\`, or \`.markdown\` candidates; HTML and Markdown may be mixed, files are reviewed in lexical filename order, and HTML must be self-contained. Starts a review URL on your machine; \`--tunnel\` shares it. Markdown frontmatter renders as metadata. Feedback exists only while this process runs. SIGINT or SIGTERM requests graceful termination: Vibe Check closes the session, prints its final summary, and exits successfully. A forced kill such as SIGKILL may stop immediately without a summary. \`--output\` mirrors lifecycle output to a file as JSON Lines with \`--json\`, or as human-readable text otherwise. Cloudflare requires \`cloudflared\`; ngrok requires an installed, authenticated ngrok client.

      Voting systems

      \`tinder\` (default): Fast triage for a broad set of candidates. Reviewers choose Pass, Keep, or Love; results rank Loves, then Keeps.

      \`stars\`: Relative ranking for a small set of alternatives when the average strength of preference matters. Reviewers choose one to five stars; results rank average rating.

      \`comment\`: Qualitative feedback for copy, proposals, or work that needs explanation rather than a forced rank. Reviewers can submit text or continue without a response; results report comment counts and the final summary lists submitted comments.

      Select a system with \`--voting <tinder|stars|comment>\` or \`--vote <system>\`. Every system permits unanswered candidates; reviewers can revisit and change recorded feedback before the session ends.
    `,
    examples: [
      ["Start a default Tinder triage", "vibe-check serve ./candidate-variants --voting tinder"],
      ["Rank close alternatives with stars", "vibe-check serve ./candidate-variants --vote stars"],
      ["Collect qualitative written feedback", "vibe-check serve ./candidate-variants --voting comment"],
      ["Use another port", "vibe-check serve ./candidate-variants --port 4214"],
      ["Emit JSON lifecycle events", "vibe-check serve ./candidate-variants --json"],
      ["Write JSON Lines lifecycle output", "vibe-check serve ./candidate-variants --json --output results.jsonl"],
      ["Write human-readable lifecycle output", "vibe-check serve ./candidate-variants --output results.txt"],
      ["Share through Cloudflare", "vibe-check serve ./candidate-variants --tunnel cloudflare"],
      ["Ask a named review question", 'vibe-check serve ./candidate-variants --name "Which landing page is clearest?"'],
    ],
  })

  directory = Option.String()
  name = Option.String("--name,-n", {
    description: "Campaign title or review question (max 255 characters; default: vibe-check)",
    required: false,
  })

  port = Option.String("--port,-p", {
    description: "Loopback port (1-65535, default: 4173)",
    required: false,
  })

  outputPath = Option.String("--output,-o", {
    description:
      "Mirror lifecycle output to a file: JSON Lines with --json, human-readable text otherwise (replaces an existing file)",
    required: false,
  })

  tunnel = Option.String("--tunnel,-t", {
    description: `Temporary public tunnel provider (${TUNNEL_PROVIDERS.join(", ")}; see details for prerequisites)`,
    required: false,
  })

  voting = Option.String("--voting,--vote", {
    description: `Feedback mechanic (${VOTING_SYSTEM_VALUES.join(", ")}; default: tinder)`,
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

      const votingSystem =
        VOTING_SYSTEM_VALUES.find(system => system === this.voting) ??
        (this.voting === undefined ? "tinder" : undefined)
      if (votingSystem === undefined) {
        await this.output({ type: "error", message: `--voting must be one of: ${VOTING_SYSTEM_VALUES.join(", ")}.` })
        return 1
      }
      const campaignTitle = parseCampaignTitle(this.name)
      if (campaignTitle === null) {
        await this.output({
          type: "error",
          message: "--name must be a nonblank title or question of at most 255 characters.",
        })
        return 1
      }

      const campaign = await new CampaignLoader([new HtmlFragmentRenderer(), new MarkdownRenderer()]).load(
        this.directory,
        campaignTitle
      )
      const feedbackStore = new InMemoryFeedbackStore(campaign.vibes, {
        recordAcceptedFeedback: feedback => {
          if (feedback.feedback.kind === "tinder") {
            return this.output({
              eventId: feedback.eventId,
              sessionId: feedback.sessionId,
              type: "vote",
              vibe: feedback.vibe,
              vote: feedback.feedback.vote,
            })
          }

          return this.output({ ...feedback, type: "feedback" })
        },
        votingSystem: votingSystem as VotingSystem,
      })
      server = new Server(campaign, feedbackStore)
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
          thankYou: `${reviewUrl}/results`,
          review: reviewUrl,
        },
      })

      const { promise, resolve } = Promise.withResolvers<void>()
      const stop = () => {
        process.off("SIGINT", stop)
        process.off("SIGTERM", stop)
        // A requested graceful shutdown always reaches the final summary and success exit path.
        void stopResources().finally(resolve)
      }

      process.once("SIGINT", stop)
      process.once("SIGTERM", stop)
      await promise

      const comments = feedbackStore.comments()
      await this.output({
        comments: comments.length > 0 ? comments : undefined,
        type: "stopped",
        hint:
          tunnelProvider === undefined
            ? "Vibe Check stopped. The session is no longer available."
            : `${tunnelProvider} tunnel closed. Vibe Check stopped. The session is no longer available.`,
        results: feedbackStore.results(),
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

/** Normalizes the optional campaign title at the CLI boundary before loading files. */
export function parseCampaignTitle(value: string | undefined): string | null {
  if (value === undefined) return "vibe-check"

  const title = value.trim()
  return title.length === 0 || title.length > 255 ? null : title
}
