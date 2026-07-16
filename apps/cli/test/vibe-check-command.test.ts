import { PassThrough } from "node:stream"

import { vi } from "vitest"

vi.mock("clipanion", () => ({
  Command: class {
    context: unknown
  },
  Option: {
    Boolean: () => false,
  },
}))

import { VibeCheckCommand } from "../src/vibe-check-command.js"

class TinderResultsCommand extends VibeCheckCommand {
  async execute(): Promise<number> {
    await this.output({
      hint: "Vibe Check stopped.",
      results: [{ file: "first.md", id: "first", keepCount: 3, label: "First", loveCount: 1 }],
      type: "stopped",
    })
    return 0
  }
}

describe("VibeCheckCommand", () => {
  it("labels the Tinder keep total as including Loves", async () => {
    const command = new TinderResultsCommand()
    const stdout = new PassThrough()
    let output = ""
    stdout.on("data", chunk => {
      output += chunk.toString()
    })

    Object.assign(command, { context: { stderr: new PassThrough(), stdout } })
    expect(await command.execute()).toBe(0)
    expect(output).toContain("Kept or loved")
  })
})
