import { createTunnelProvider } from "./providers/factory.js"
import { TUNNEL_PROVIDERS, type ActiveTunnel, type TunnelProviderName } from "./providers/tunnel-provider.js"

export { TUNNEL_PROVIDERS, type ActiveTunnel }
export type TunnelProvider = TunnelProviderName

/** Starts the requested public tunnel while leaving Campaign state on the Creator host. */
export async function startTunnel(provider: TunnelProvider, originUrl: string): Promise<ActiveTunnel> {
  return createTunnelProvider(provider).start(originUrl)
}
