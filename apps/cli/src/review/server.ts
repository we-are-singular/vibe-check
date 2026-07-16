import { createAdaptorServer } from "@hono/node-server"
import type { Server as HttpServer } from "node:http"
import type { AddressInfo } from "node:net"
import type { Campaign } from "../campaign/campaign-loader.js"
import type { InMemoryFeedbackStore } from "./in-memory-feedback-store.js"
import { createReviewApp } from "./app.js"

/** Owns the POC's Node listener around the portable review HTTP application. */
export class Server {
  private readonly server: HttpServer

  constructor(campaign: Campaign, feedbackStore: InMemoryFeedbackStore) {
    const app = createReviewApp({ campaign, feedbackStore })

    // The Hono Node adapter leaves listener lifecycle with the CLI host.
    this.server = createAdaptorServer({ fetch: app.fetch }) as HttpServer
  }

  async start(port: number): Promise<{ url: string }> {
    const { promise, reject, resolve } = Promise.withResolvers<void>()
    const onError = (error: Error) => {
      this.server.off("listening", onListening)
      reject(error)
    }
    const onListening = () => {
      this.server.off("error", onError)
      resolve()
    }

    this.server.once("error", onError)
    this.server.once("listening", onListening)
    this.server.listen(port, "127.0.0.1")
    await promise

    const address = this.server.address()
    if (!address || typeof address === "string") {
      throw new Error("Review server did not bind to a TCP address.")
    }

    return { url: `http://127.0.0.1:${(address as AddressInfo).port}` }
  }

  async stop(): Promise<void> {
    if (!this.server.listening) return

    const { promise, reject, resolve } = Promise.withResolvers<void>()
    this.server.close(error => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
    await promise
  }
}
