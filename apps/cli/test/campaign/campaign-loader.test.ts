import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { CampaignLoader, normalizeCampaignDirectoryPath } from "../../src/campaign/campaign-loader.js"
import { HtmlFragmentRenderer } from "../../src/campaign/renderers/html-fragment-renderer.js"

describe("normalizeCampaignDirectoryPath", () => {
  it("converts a leading MSYS drive path on Windows", () => {
    expect(normalizeCampaignDirectoryPath("/c/Users/ada/candidates", "win32")).toBe("C:/Users/ada/candidates")
  })

  it("leaves non-MSYS and non-Windows paths unchanged", () => {
    expect(normalizeCampaignDirectoryPath("C:/Users/ada/candidates", "win32")).toBe("C:/Users/ada/candidates")
    expect(normalizeCampaignDirectoryPath("/home/ada/candidates", "win32")).toBe("/home/ada/candidates")
    expect(normalizeCampaignDirectoryPath("/c/Users/ada/candidates", "linux")).toBe("/c/Users/ada/candidates")
  })
})

describe("CampaignLoader", () => {
  it("uses the default review question and preserves a supplied title", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vibe-check-campaign-"))
    await Promise.all([
      writeFile(join(directory, "first.html"), "<p>First candidate</p>"),
      writeFile(join(directory, "second.html"), "<p>Second candidate</p>"),
    ])

    try {
      const loader = new CampaignLoader([new HtmlFragmentRenderer()])
      expect((await loader.load(directory)).title).toBe("What do you think?")
      expect((await loader.load(directory, "Which draft should we ship?")).title).toBe("Which draft should we ship?")
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })
})
