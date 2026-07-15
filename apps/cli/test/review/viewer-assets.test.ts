import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { ViewerAssets } from "../../src/review/viewer-assets.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
})

async function createViewerDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "vibe-check-viewer-"))
  temporaryDirectories.push(directory)
  await mkdir(join(directory, ".vite"))
  await mkdir(join(directory, "assets"))
  await writeFile(join(directory, "index.html"), "<!doctype html><main>viewer</main>")
  await writeFile(
    join(directory, ".vite", "manifest.json"),
    JSON.stringify({ "src/main.tsx": { css: ["assets/app.css"], isEntry: true } })
  )
  await writeFile(join(directory, "assets", "app.css"), "body { color: black; }")
  await writeFile(join(directory, "assets", "app.js"), "console.log('viewer')")
  return directory
}

describe("ViewerAssets", () => {
  it("serves built runtime files and the virtual Markdown stylesheet", async () => {
    const assets = new ViewerAssets(await createViewerDirectory())

    expect(await assets.indexHtml()).toContain("viewer")
    expect((await assets.asset("assets/app.js"))?.body.toString()).toContain("console.log")
  })

  it("rejects unsupported, hidden, and traversing paths", async () => {
    const directory = await createViewerDirectory()
    const assets = new ViewerAssets(directory)
    await writeFile(join(directory, "assets", "app.js.map"), "{}")
    await writeFile(join(directory, ".secret.js"), "secret")

    await expect(assets.asset("assets/app.js.map")).resolves.toBeNull()
    await expect(assets.asset(".secret.js")).resolves.toBeNull()
    await expect(assets.asset("../package.json")).resolves.toBeNull()
  })

  it.skipIf(process.platform === "win32")("rejects symlinked files", async () => {
    const directory = await createViewerDirectory()
    const outsideFile = join(tmpdir(), `vibe-check-outside-${Date.now()}.js`)
    await writeFile(outsideFile, "secret")
    await symlink(outsideFile, join(directory, "assets", "outside.js"))

    await expect(new ViewerAssets(directory).asset("assets/outside.js")).resolves.toBeNull()
    await rm(outsideFile, { force: true })
  })
})
