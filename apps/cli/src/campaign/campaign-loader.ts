import { readdir } from "node:fs/promises"
import { extname, resolve } from "node:path"
import type { RenderedVibe, VibeRenderer } from "../types.js"
import { stableVibeId } from "./utils.js"

/** A loaded direct-child artifact collection ready for one review session. */
export type Campaign = {
  directory: string
  title: string
  vibes: readonly RenderedVibe[]
}

/**
 * Discovers direct-child artifacts and asks the matching renderer to produce
 * the preview data consumed by the review flow.
 */
export class CampaignLoader {
  constructor(private readonly renderers: readonly VibeRenderer[]) {}

  async load(directory: string, title = "vibe-check"): Promise<Campaign> {
    const absoluteDirectory = resolve(normalizeCampaignDirectoryPath(directory))
    const entries = await this.readDirectory(absoluteDirectory)
    const candidateNames = entries
      .filter(entry => entry.isFile() && this.findRenderer(entry.name) !== undefined)
      .map(entry => entry.name)
      .sort((left, right) => (left === right ? 0 : left < right ? -1 : 1))

    if (candidateNames.length < 2) {
      throw new Error(
        `Expected at least two supported candidate files in ${absoluteDirectory}; found ${candidateNames.length}.`
      )
    }

    const vibes = await Promise.all(
      candidateNames.map(async filename => {
        const renderer = this.findRenderer(filename)
        if (!renderer) {
          throw new Error(`No renderer supports ${filename}.`)
        }

        const relativePath = filename
        const id = stableVibeId(relativePath)
        const rendered = await renderer.render({
          absolutePath: resolve(absoluteDirectory, filename),
          id,
          relativePath,
        })

        return {
          file: relativePath,
          id,
          ...rendered,
        }
      })
    )

    return {
      directory: absoluteDirectory,
      title,
      vibes,
    }
  }

  private findRenderer(filename: string): VibeRenderer | undefined {
    const extension = extname(filename).toLowerCase()
    return this.renderers.find(renderer => renderer.extensions.includes(extension))
  }

  private async readDirectory(directory: string) {
    try {
      return await readdir(directory, { withFileTypes: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Cannot read ${directory}: ${message}`, { cause: error })
    }
  }
}

/**
 * Converts the MSYS drive-root form that Node does not interpret as a Windows
 * drive path. Other path forms remain the caller's responsibility.
 */
export function normalizeCampaignDirectoryPath(directory: string, platform = process.platform): string {
  if (platform !== "win32") return directory

  const msysDrivePath = /^\/([a-zA-Z])\/(.*)$/.exec(directory)
  return msysDrivePath === null ? directory : `${msysDrivePath[1]?.toUpperCase()}:/${msysDrivePath[2]}`
}
