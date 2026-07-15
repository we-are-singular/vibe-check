import { spawn, type ChildProcessByStdio } from "node:child_process"
import type { Readable } from "node:stream"

import type { ActiveTunnel, TunnelProvider } from "./tunnel-provider.js"

type CloudflaredProcess = ChildProcessByStdio<null, Readable, Readable>

const CLOUDFLARE_QUICK_TUNNEL_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i
const STARTUP_TIMEOUT_MS = 30_000
const STOP_TIMEOUT_MS = 5_000

/** Starts Cloudflare Quick Tunnels backed by a local cloudflared process. */
export class CloudflareQuickTunnelProvider implements TunnelProvider {
  async start(originUrl: string): Promise<ActiveTunnel> {
    const process = spawn("cloudflared", ["tunnel", "--url", originUrl], {
      stdio: ["ignore", "pipe", "pipe"],
    })
    const tunnel = new CloudflareQuickTunnel(process)

    try {
      return await tunnel.waitForPublicUrl()
    } catch (error) {
      await tunnel.stop()
      throw error
    }
  }
}

class CloudflareQuickTunnel implements ActiveTunnel {
  private readonly startup = Promise.withResolvers<string>()
  private output = ""
  private publicUrlValue: string | undefined
  private spawnFailed = false

  constructor(private readonly process: CloudflaredProcess) {
    this.process.stdout.setEncoding("utf8")
    this.process.stderr.setEncoding("utf8")
    this.process.stdout.on("data", this.captureOutput)
    this.process.stderr.on("data", this.captureOutput)
    this.process.once("error", error => {
      this.spawnFailed = true
      this.startup.reject(new Error(`Unable to start cloudflared. Install cloudflared and retry: ${error.message}`))
    })
    this.process.once("exit", (code, signal) => {
      if (this.publicUrlValue !== undefined) return
      const reason = signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`
      this.startup.reject(
        new Error(`cloudflared exited before providing a public URL (${reason}).${this.outputSummary()}`)
      )
    })
  }

  get publicUrl(): string {
    if (this.publicUrlValue === undefined) throw new Error("Cloudflare tunnel did not provide a public URL.")
    return this.publicUrlValue
  }

  async waitForPublicUrl(): Promise<ActiveTunnel> {
    const timeout = setTimeout(() => {
      this.startup.reject(
        new Error(`Timed out waiting for cloudflared to provide a public URL.${this.outputSummary()}`)
      )
    }, STARTUP_TIMEOUT_MS)

    try {
      this.publicUrlValue = await this.startup.promise
      return this
    } finally {
      clearTimeout(timeout)
    }
  }

  async stop(): Promise<void> {
    if (this.spawnFailed || this.process.exitCode !== null || this.process.signalCode !== null) return

    const { promise, resolve } = Promise.withResolvers<void>()
    const timeout = setTimeout(() => {
      this.process.kill("SIGKILL")
      resolve()
    }, STOP_TIMEOUT_MS)
    this.process.once("exit", () => {
      clearTimeout(timeout)
      resolve()
    })
    this.process.kill("SIGTERM")
    await promise
  }

  private readonly captureOutput = (chunk: Buffer | string): void => {
    const text = chunk.toString()
    this.output = `${this.output}${text}`.slice(-4_096)
    const publicUrl = this.output.match(CLOUDFLARE_QUICK_TUNNEL_URL)?.[0]
    if (publicUrl !== undefined) this.startup.resolve(publicUrl)
  }

  private outputSummary(): string {
    const output = this.output.trim()
    return output.length === 0 ? "" : ` cloudflared output: ${output}`
  }
}
