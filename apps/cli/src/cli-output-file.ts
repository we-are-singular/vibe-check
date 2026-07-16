import { open, type FileHandle } from "node:fs/promises"

/**
 * Mirrors rendered CLI lifecycle output to a user-selected file.
 *
 * The file is truncated when the session starts, then each awaited append preserves
 * event order through graceful shutdown.
 */
export class CliOutputFile {
  private readonly appendedEventIds = new Set<string>()

  private constructor(private readonly handle: FileHandle) {}

  static async create(path: string): Promise<CliOutputFile> {
    return new CliOutputFile(await open(path, "w"))
  }

  /**
   * Appends a lifecycle event once per process when an idempotency key is supplied.
   * The key is retained only after the file write resolves, so failed writes retry.
   */
  async append(output: string, eventId?: string): Promise<void> {
    if (eventId !== undefined && this.appendedEventIds.has(eventId)) return

    await this.handle.writeFile(output, "utf8")
    if (eventId !== undefined) this.appendedEventIds.add(eventId)
  }

  async close(): Promise<void> {
    await this.handle.close()
  }
}
