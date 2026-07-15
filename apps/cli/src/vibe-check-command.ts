import { Command, Option } from "clipanion"
import type { ResultRow } from "./types.js"

/** JSON lines emitted by CLI commands for people and automation. */
export type CommandOutput =
  | {
      campaign: {
        directory: string
        title: string
        vibeCount: number
      }
      hint: string
      type: "started"
      urls: {
        apiResults: string
        results: string
        review: string
        public?: string
      }
    }
  | {
      hint: string
      results: readonly ResultRow[]
      type: "stopped"
    }
  | {
      message: string
      type: "error"
    }

/** Provides human-readable text and JSON Lines lifecycle output for CLI commands. */
export abstract class VibeCheckCommand extends Command {
  json = Option.Boolean("--json", {
    description: "Emit newline-delimited JSON lifecycle events.",
    required: false,
  })

  protected output(event: CommandOutput): void {
    const stream = event.type === "error" ? this.context.stderr : this.context.stdout
    stream.write(this.json ? `${JSON.stringify(event)}\n` : formatTextOutput(event))
  }
}

function formatTextOutput(event: CommandOutput): string {
  switch (event.type) {
    case "started": {
      const publicUrl = event.urls.public === undefined ? [] : [`Public:  ${event.urls.public}`]
      return (
        [
          `Loaded ${event.campaign.vibeCount} vibes from ${event.campaign.directory}.`,
          "",
          `Review:  ${event.urls.review}`,
          `Results: ${event.urls.results}`,
          `JSON:    ${event.urls.apiResults}`,
          ...publicUrl,
          "",
          event.hint,
        ].join("\n") + "\n"
      )
    }
    case "stopped":
      return `${formatResultTable(event.results)}\n\n${event.hint}\n`
    case "error":
      return `error: ${event.message}\n`
  }
}

type ResultTableRow = readonly [vibe: string, loves: string, keeps: string]

function formatResultTable(results: readonly ResultRow[]): string {
  const headers: ResultTableRow = ["Vibe", "Loves", "Keeps"]
  const rows: readonly ResultTableRow[] = results.map(result => [
    asSingleLine(result.label),
    formatLoveCount(result.loveCount),
    String(result.keepCount),
  ])
  const widths: readonly [number, number, number] = [
    Math.max(headers[0].length, ...rows.map(row => row[0].length)),
    Math.max(headers[1].length, ...rows.map(row => row[1].length)),
    Math.max(headers[2].length, ...rows.map(row => row[2].length)),
  ]
  const divider = `+${widths.map(width => "-".repeat(width + 2)).join("+")}+`
  const renderRow = (row: ResultTableRow) =>
    `| ${row[0].padEnd(widths[0])} | ${row[1].padStart(widths[1])} | ${row[2].padStart(widths[2])} |`

  return ["Results", divider, renderRow(headers), divider, ...rows.map(renderRow), divider].join("\n")
}

function formatLoveCount(loveCount: number): string {
  return "❤️".repeat(loveCount) || "—"
}

function asSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}
