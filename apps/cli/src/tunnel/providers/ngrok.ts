import { spawn, type ChildProcessByStdio } from "node:child_process"
import type { Readable } from "node:stream"

import type { ActiveTunnel, TunnelProvider } from "./tunnel-provider.js"

type NgrokProcess = ChildProcessByStdio<null, Readable, Readable>

const NGROK_PUBLIC_URL = /https:\/\/[a-z0-9-]+\.(?:ngrok\.app|ngrok-free\.app)(?=\/|\s|$)/i
const NGROK_AUTHENTICATION_ERROR = /ERR_NGROK_401[0-9]|authtoken|authentication (?:failed|required)|not authorized/i
const STARTUP_TIMEOUT_MS = 30_000
const STOP_TIMEOUT_MS = 5_000
const NGROK_AUTHENTICATION_COMMAND = "ngrok config add-authtoken <token>"

/** Starts ngrok HTTP tunnels backed by a local ngrok process. */
export class NgrokTunnelProvider implements TunnelProvider {
  async start(originUrl: string): Promise<ActiveTunnel> {
    const process = spawn("ngrok", ["http", originUrl], {
      stdio: ["ignore", "pipe", "pipe"],
    })
    const tunnel = new NgrokTunnel(process)

    try {
      return await tunnel.waitForPublicUrl()
    } catch (error) {
      await tunnel.stop()
      throw error
    }
  }
}

class NgrokTunnel implements ActiveTunnel {
  private readonly startup = Promise.withResolvers<string>()
  private output = ""
  private publicUrlValue: string | undefined
  private spawnFailed = false
  private stopPromise: Promise<void> | undefined

  constructor(private readonly process: NgrokProcess) {
    this.process.stdout.setEncoding("utf8")
    this.process.stderr.setEncoding("utf8")
    this.process.stdout.on("data", this.captureOutput)
    this.process.stderr.on("data", this.captureOutput)
    this.process.once("error", error => {
      this.spawnFailed = true
      this.startup.reject(
        new Error(
          `Unable to start ngrok. Install ngrok and authenticate it with \`${NGROK_AUTHENTICATION_COMMAND}\`: ${error.message}`
        )
      )
    })
    this.process.once("exit", (code, signal) => {
      if (this.publicUrlValue !== undefined) return
      const reason = signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`
      this.startup.reject(new Error(this.earlyExitMessage(reason)))
    })
  }

  get publicUrl(): string {
    if (this.publicUrlValue === undefined) throw new Error("ngrok did not provide a public URL.")
    return this.publicUrlValue
  }

  async waitForPublicUrl(): Promise<ActiveTunnel> {
    const timeout = setTimeout(() => {
      this.startup.reject(new Error(`Timed out waiting for ngrok to provide a public URL.${this.outputSummary()}`))
    }, STARTUP_TIMEOUT_MS)

    try {
      this.publicUrlValue = await this.startup.promise
      return this
    } finally {
      clearTimeout(timeout)
    }
  }

  async stop(): Promise<void> {
    if (this.stopPromise !== undefined) return this.stopPromise
    if (this.spawnFailed || this.process.exitCode !== null || this.process.signalCode !== null) return

    this.stopPromise = this.stopProcess()
    return this.stopPromise
  }

  private async stopProcess(): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>()
    const timeout = setTimeout(() => {
      this.process.kill("SIGKILL")
      resolve()
    }, STOP_TIMEOUT_MS)
    this.process.once("exit", () => {
      clearTimeout(timeout)
      resolve()
    })

    if (!this.process.kill("SIGTERM")) {
      clearTimeout(timeout)
      resolve()
    }

    await promise
  }

  private readonly captureOutput = (chunk: Buffer | string): void => {
    const text = chunk.toString()
    this.output = `${this.output}${text}`.slice(-4_096)
    const publicUrl = this.output.match(NGROK_PUBLIC_URL)?.[0]
    if (publicUrl !== undefined) this.startup.resolve(publicUrl)
  }

  private earlyExitMessage(reason: string): string {
    if (NGROK_AUTHENTICATION_ERROR.test(this.output)) {
      return `ngrok authentication failed before providing a public URL (${reason}). Run \`${NGROK_AUTHENTICATION_COMMAND}\` and retry.${this.outputSummary()}`
    }

    return `ngrok exited before providing a public URL (${reason}). Ensure ngrok is installed and authenticated with \`${NGROK_AUTHENTICATION_COMMAND}\`, then retry.${this.outputSummary()}`
  }

  private outputSummary(): string {
    const output = this.output.trim()
    return output.length === 0 ? "" : ` ngrok output: ${output}`
  }
}
