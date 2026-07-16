import { PassThrough } from "node:stream"

import { vi } from "vitest"

const loaderLoads = vi.hoisted(() => [] as unknown[][])
const stringOption = vi.hoisted(() => vi.fn(() => undefined))

vi.mock("clipanion", () => ({
  Command: class {
    context: unknown
    static Usage<T>(usage: T): T {
      return usage
    }
  },
  Option: {
    Boolean: () => false,
    String: stringOption,
  },
}))

vi.mock("../../src/campaign/campaign-loader.js", () => ({
  CampaignLoader: class {
    async load(...args: unknown[]) {
      loaderLoads.push(args)
      return {
        directory: "/campaign",
        title: args[1],
        vibes: [
          { file: "first.md", id: "first", label: "First", preview: { content: "", kind: "markdown" } },
          { file: "second.md", id: "second", label: "Second", preview: { content: "", kind: "markdown" } },
        ],
      }
    }
  },
}))

vi.mock("../../src/review/server.js", () => ({
  Server: class {
    async start() {
      return { url: "http://127.0.0.1:4173" }
    }

    async stop() {}
  },
}))

import { ServeCommand } from "../../src/commands/serve.command.js"

describe("serve", () => {
  beforeEach(() => {
    loaderLoads.length = 0
  })

  it("documents graceful signals, forced termination, and output file formats", () => {
    expect(ServeCommand.usage.details).toContain("SIGINT or SIGTERM requests graceful termination")
    expect(ServeCommand.usage.details).toContain("A forced kill such as SIGKILL may stop immediately without a summary")
    expect(ServeCommand.usage.details).toContain("JSON Lines with `--json`, or as human-readable text otherwise")
    expect(ServeCommand.usage.examples).toContainEqual([
      "Write JSON Lines lifecycle output",
      "vibe-check serve ./candidate-variants --json --output results.jsonl",
    ])
    expect(ServeCommand.usage.examples).toContainEqual([
      "Write human-readable lifecycle output",
      "vibe-check serve ./candidate-variants --output results.txt",
    ])
  })

  it("registers the --name and -n aliases", () => {
    expect(new ServeCommand()).toBeInstanceOf(ServeCommand)
    expect(stringOption).toHaveBeenCalledWith(
      "--name,-n",
      expect.objectContaining({
        description: expect.stringContaining("default: vibe-check"),
        required: false,
      })
    )
  })

  it.each([
    [undefined, "vibe-check"],
    ["  Which draft should we ship?  ", "Which draft should we ship?"],
  ])("loads the campaign with title %j", async (name, expectedTitle) => {
    const stdout = new PassThrough()
    const output: string[] = []
    stdout.on("data", chunk => {
      output.push(chunk.toString())
    })

    const command = new ServeCommand()
    Object.assign(command, {
      context: { stderr: new PassThrough(), stdout },
      directory: "/campaign",
      name,
      port: "4173",
    })
    const completed = command.execute()
    await vi.waitFor(() => expect(output.join("")).toContain("Review is ready."))
    process.emit("SIGTERM")

    expect(await completed).toBe(0)
    expect(loaderLoads).toEqual([["/campaign", expectedTitle]])
    expect(output.join("")).toContain(`Campaign: ${expectedTitle}`)
  })

  it.each(["", " \t\n ", "x".repeat(256)])("rejects invalid campaign title %j before loading", async name => {
    const stderr = new PassThrough()
    const output: string[] = []
    stderr.on("data", chunk => {
      output.push(chunk.toString())
    })

    const command = new ServeCommand()
    Object.assign(command, {
      context: { stderr, stdout: new PassThrough() },
      directory: "/campaign",
      name,
      port: "4173",
    })

    expect(await command.execute()).toBe(1)
    expect(loaderLoads).toEqual([])
    expect(output.join("")).toContain("--name must be a nonblank title or question of at most 255 characters.")
  })

  it("returns success and prints the stopped summary after SIGTERM", async () => {
    const stdout = new PassThrough()

    const output: string[] = []
    stdout.on("data", chunk => {
      output.push(chunk.toString())
    })

    const command = new ServeCommand()
    Object.assign(command, {
      context: { stderr: new PassThrough(), stdout },
      directory: "/campaign",
      port: "4173",
    })
    const completed = command.execute()
    await vi.waitFor(() => expect(output.join("")).toContain("Review is ready."))
    process.emit("SIGTERM")

    expect(await completed).toBe(0)
    expect(output.join("")).toContain("Results")
    expect(output.join("")).toContain("Vibe Check stopped. The session is no longer available.")
  })
})
