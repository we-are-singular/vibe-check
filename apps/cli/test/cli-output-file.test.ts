import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { CliOutputFile } from "../src/cli-output-file.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
})

describe("CliOutputFile", () => {
  it("replaces prior content and preserves lifecycle event order", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vibe-check-output-"))
    temporaryDirectories.push(directory)
    const outputPath = join(directory, "session.log")
    await writeFile(outputPath, "stale output\n")

    const output = await CliOutputFile.create(outputPath)
    try {
      await output.append("started\n")
      await output.append("stopped\n")
    } finally {
      await output.close()
    }

    await expect(readFile(outputPath, "utf8")).resolves.toBe("started\nstopped\n")
  })
})
