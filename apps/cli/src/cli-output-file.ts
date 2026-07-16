import { open, type FileHandle } from "node:fs/promises"

/**
 * Mirrors rendered CLI lifecycle output to a user-selected file.
 *
 * The file is truncated when the session starts, then each awaited append preserves
 * event order through graceful shutdown.
 */
export class CliOutputFile {
  private constructor(private readonly handle: FileHandle) {}

  static async create(path: string): Promise<CliOutputFile> {
    return new CliOutputFile(await open(path, "w"))
  }

  async append(output: string): Promise<void> {
    await this.handle.writeFile(output, "utf8")
  }

  async close(): Promise<void> {
    await this.handle.close()
  }
}
