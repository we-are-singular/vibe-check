import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"

import { beforeEach, describe, expect, it, vi } from "vitest"

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))

vi.mock("node:child_process", () => ({ spawn: spawnMock }))

import { startTunnel } from "../../src/tunnel/tunnel.js"

class FakeTunnelProcess extends EventEmitter {
  readonly stdout = new PassThrough()
  readonly stderr = new PassThrough()
  readonly exited = Promise.withResolvers<void>()
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null

  readonly kill = vi.fn((signal?: NodeJS.Signals): boolean => {
    this.signalCode = signal ?? "SIGTERM"
    this.emit("exit", null, this.signalCode)
    this.exited.resolve()
    return true
  })

  exit(code: number): void {
    this.exitCode = code
    this.emit("exit", code, null)
    this.exited.resolve()
  }
}

function spawnFakeProcess(): FakeTunnelProcess {
  const process = new FakeTunnelProcess()
  spawnMock.mockReturnValue(process)
  return process
}

beforeEach(() => {
  spawnMock.mockReset()
})

describe("startTunnel", () => {
  it("starts a Cloudflare Quick Tunnel and resolves its public URL", async () => {
    const process = spawnFakeProcess()
    const origin = "http://127.0.0.1:4173"

    const starting = startTunnel("cloudflare", origin)
    process.stderr.write("INF Your quick Tunnel has been created! Visit https://violet-wolf.trycloudflare.com")

    const tunnel = await starting

    expect(tunnel.publicUrl).toBe("https://violet-wolf.trycloudflare.com")
    expect(spawnMock).toHaveBeenCalledWith("cloudflared", ["tunnel", "--url", origin], {
      stdio: ["ignore", "pipe", "pipe"],
    })

    await tunnel.stop()
    await process.exited.promise
    expect(process.kill).toHaveBeenCalledWith("SIGTERM")
  })

  it("starts an ngrok HTTP tunnel and resolves its public URL", async () => {
    const process = spawnFakeProcess()
    const origin = "http://localhost:3000"

    const starting = startTunnel("ngrok", origin)
    process.stdout.write("started tunnel url=https://violet-wolf.ngrok.app")

    const tunnel = await starting

    expect(tunnel.publicUrl).toBe("https://violet-wolf.ngrok.app")
    expect(spawnMock).toHaveBeenCalledWith("ngrok", ["http", origin], {
      stdio: ["ignore", "pipe", "pipe"],
    })

    await tunnel.stop()
    await process.exited.promise
    expect(process.kill).toHaveBeenCalledWith("SIGTERM")
  })

  it("accepts the current ngrok free development domain", async () => {
    const process = spawnFakeProcess()

    const starting = startTunnel("ngrok", "http://localhost:3000")
    process.stdout.write("started tunnel url=https://violet-wolf.ngrok-free.app")

    const tunnel = await starting

    expect(tunnel.publicUrl).toBe("https://violet-wolf.ngrok-free.app")

    await tunnel.stop()
    await process.exited.promise
  })

  it("gives ngrok authentication guidance when ngrok exits before starting", async () => {
    const process = spawnFakeProcess()

    const starting = startTunnel("ngrok", "http://localhost:3000")
    process.stderr.write("ERR_NGROK_4018 authentication failed: authtoken missing")
    process.exit(1)

    await expect(starting).rejects.toThrow("ngrok config add-authtoken <token>")
  })
})
