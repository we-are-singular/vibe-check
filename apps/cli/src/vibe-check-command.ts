import { Command, Option } from "clipanion"
import { CliOutputFile } from "./cli-output-file.js"
import type { CommentLog, Feedback, ResultRow, Vote } from "./types.js"

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
        thankYou: string
        review: string
        public?: string
      }
    }
  | {
      comments?: readonly CommentLog[]
      hint: string
      results: readonly ResultRow[]
      type: "stopped"
    }
  | {
      eventId: string
      sessionId: string
      type: "vote"
      vibe: {
        file: string
        id: string
        label: string
      }
      vote: Vote
    }
  | {
      eventId: string
      feedback: Feedback
      sessionId: string
      type: "feedback"
      vibe: {
        file: string
        id: string
        label: string
      }
    }
  | {
      message: string
      type: "error"
    }

/** Provides human-readable text and JSON Lines lifecycle output for CLI commands. */
export abstract class VibeCheckCommand extends Command {
  json = Option.Boolean("--json", {
    description: "Emit newline-delimited JSON lifecycle events, including accepted feedback.",
    required: false,
  })

  private outputFile: CliOutputFile | undefined

  /** Starts mirroring rendered lifecycle events to a fresh file. */
  protected async openOutputFile(path: string): Promise<void> {
    this.outputFile = await CliOutputFile.create(path)
  }

  /** Closes the optional output file after the final lifecycle event has been written. */
  protected async closeOutputFile(): Promise<void> {
    const outputFile = this.outputFile
    this.outputFile = undefined
    await outputFile?.close()
  }

  protected async output(event: CommandOutput): Promise<void> {
    const stream = event.type === "error" ? this.context.stderr : this.context.stdout
    const rendered = this.json ? `${JSON.stringify(event)}\n` : formatTextOutput(event)

    try {
      // Persist before emitting so accepted feedback survives a later forced process kill.
      await this.outputFile?.append(rendered, getEventId(event))
    } catch (error) {
      await this.closeOutputFile().catch(() => undefined)
      throw error
    }
    stream.write(rendered)
  }
}

function getEventId(event: CommandOutput): string | undefined {
  return event.type === "vote" || event.type === "feedback" ? event.eventId : undefined
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
          `Thanks:  ${event.urls.thankYou}`,
          `JSON:    ${event.urls.apiResults}`,
          ...publicUrl,
          "",
          event.hint,
        ].join("\n") + "\n"
      )
    }
    case "stopped":
      return `${formatResultTable(event.results)}${formatComments(event.comments)}\n\n${event.hint}\n`
    case "vote":
      return formatRecord(event.sessionId, event.vibe.file, `vote: ${event.vote}`)
    case "feedback":
      return formatRecord(event.sessionId, event.vibe.file, describeFeedback(event.feedback))
    case "error":
      return `error: ${asSingleLine(event.message)}\n`
  }
}

function formatResultTable(results: readonly ResultRow[]): string {
  const table = getResultTable(results)
  const widths = table.headers.map((header, index) =>
    Math.max(header.length, ...table.rows.map(row => row[index]?.length ?? 0))
  )
  const divider = `+${widths.map(width => "-".repeat(width + 2)).join("+")}+`
  const renderRow = (row: readonly string[]) =>
    `| ${row
      .map((cell, index) => cell.padStart(index === 0 ? cell.length : (widths[index] ?? 0)))
      .map((cell, index) => cell.padEnd(widths[index] ?? 0))
      .join(" | ")} |`

  return ["Results", divider, renderRow(table.headers), divider, ...table.rows.map(renderRow), divider].join("\n")
}

function getResultTable(results: readonly ResultRow[]): {
  headers: readonly string[]
  rows: readonly (readonly string[])[]
} {
  const first = results[0]
  if (first && "votingSystem" in first && first.votingSystem === "stars") {
    return {
      headers: ["Vibe", "Rating", "Ratings"],
      rows: results.map(result => {
        if (!("votingSystem" in result) || result.votingSystem !== "stars") {
          throw new Error("Mixed voting systems are not supported.")
        }
        return [
          asSingleLine(result.label),
          result.averageRating === null ? "—" : result.averageRating.toFixed(1),
          String(result.ratingCount),
        ]
      }),
    }
  }
  if (first && "votingSystem" in first && first.votingSystem === "comment") {
    return {
      headers: ["Vibe", "Comments"],
      rows: results.map(result => {
        if (!("votingSystem" in result) || result.votingSystem !== "comment") {
          throw new Error("Mixed voting systems are not supported.")
        }
        return [asSingleLine(result.label), String(result.commentCount)]
      }),
    }
  }

  return {
    headers: ["Vibe", "Loves", "Kept or loved"],
    rows: results.map(result => {
      if ("votingSystem" in result) throw new Error("Mixed voting systems are not supported.")
      return [asSingleLine(result.label), formatLoveCount(result.loveCount), String(result.keepCount)]
    }),
  }
}

function describeFeedback(feedback: Feedback): string {
  if (feedback.kind === "stars") return `rating: ${feedback.rating}/5`
  if (feedback.kind === "comment")
    return feedback.comment.trim() ? `comment: ${asSingleLine(feedback.comment)}` : "comment cleared"
  return `vote: ${feedback.vote}`
}

function formatRecord(sessionId: string, vibeFile: string, message: string): string {
  return `[${asSingleLine(sessionId)}] [${asSingleLine(vibeFile)}] ${message}\n`
}

function formatComments(comments: readonly CommentLog[] | undefined): string {
  if (!comments?.length) return ""

  return `\n\nComments\n${comments
    .map(
      comment =>
        `[${asSingleLine(comment.sessionId)}] [${asSingleLine(comment.vibe.file)}]\n${formatCommentText(comment.comment)}`
    )
    .join("\n\n")}`
}

function formatCommentText(comment: string): string {
  return sanitizeTerminalText(comment, true)
    .split("\n")
    .map(line => `  ${line}`)
    .join("\n")
}

function formatLoveCount(loveCount: number): string {
  return "❤️".repeat(loveCount) || "—"
}

function asSingleLine(value: string): string {
  return sanitizeTerminalText(value, false)
}

const ANSI_ESCAPE = String.fromCharCode(0x1b)
const ANSI_BELL = String.fromCharCode(0x07)
const ANSI_SEQUENCE = new RegExp(
  `${ANSI_ESCAPE}(?:\\][^${ANSI_BELL}]*(?:${ANSI_BELL}|${ANSI_ESCAPE}\\\\)|\\[[0-?]*[ -/]*[@-~])`,
  "g"
)

function sanitizeTerminalText(value: string, preserveNewlines: boolean): string {
  return removeTerminalControls(value.replace(ANSI_SEQUENCE, "").replace(/\r\n?/g, "\n"), preserveNewlines)
}

function removeTerminalControls(value: string, preserveNewlines: boolean): string {
  const text: string[] = []

  for (const character of value) {
    const codePoint = character.charCodeAt(0)
    const isLineFeed = codePoint === 0x0a
    const isC0Control = codePoint <= 0x1f
    const isC1Control = codePoint >= 0x7f && codePoint <= 0x9f
    if ((isC0Control && (!preserveNewlines || !isLineFeed)) || isC1Control) continue
    text.push(character)
  }

  return text.join("")
}
