export const TUNNEL_PROVIDERS = ["cloudflare", "ngrok"] as const
export type TunnelProviderName = (typeof TUNNEL_PROVIDERS)[number]

export type ActiveTunnel = {
  publicUrl: string
  stop(): Promise<void>
}

/** Starts and owns one public tunnel process for a local review origin. */
export interface TunnelProvider {
  start(originUrl: string): Promise<ActiveTunnel>
}
