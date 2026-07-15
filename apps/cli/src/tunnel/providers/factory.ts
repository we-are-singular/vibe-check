import { CloudflareQuickTunnelProvider } from "./cloudflare.js"
import { NgrokTunnelProvider } from "./ngrok.js"
import type { TunnelProvider, TunnelProviderName } from "./tunnel-provider.js"

const PROVIDER_FACTORIES: Record<TunnelProviderName, () => TunnelProvider> = {
  cloudflare: () => new CloudflareQuickTunnelProvider(),
  ngrok: () => new NgrokTunnelProvider(),
}

/** Creates the concrete provider selected by the CLI's validated tunnel name. */
export function createTunnelProvider(provider: TunnelProviderName): TunnelProvider {
  return PROVIDER_FACTORIES[provider]()
}
