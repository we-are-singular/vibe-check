const VIBE_CHECK_BANNER = [
  "░██    ░██ ░██░██                        ░██████  ░██                              ░██",
  "░██    ░██    ░██                       ░██   ░██ ░██                              ░██",
  "░██    ░██ ░██░████████   ░███████     ░██        ░████████   ░███████   ░███████  ░██    ░██",
  "░██    ░██ ░██░██    ░██ ░██    ░██    ░██        ░██    ░██ ░██    ░██ ░██    ░██ ░██   ░██",
  " ░██  ░██  ░██░██    ░██ ░█████████    ░██        ░██    ░██ ░█████████ ░██        ░███████",
  "  ░██░██   ░██░███   ░██ ░██            ░██   ░██ ░██    ░██ ░██        ░██    ░██ ░██   ░██",
  "   ░███    ░██░██░█████   ░███████       ░██████  ░██    ░██  ░███████   ░███████  ░██    ░██",
].join("\n")

export type WelcomeContext = {
  readonly bannerPreference?: string
  readonly columns?: number
  readonly isTTY: boolean
  readonly rows?: number
}

/** Formats the same onboarding help across terminals while adapting its title to output capability. */
export function formatWelcomeScreen(context: WelcomeContext): string {
  const preference = resolveBannerPreference(context.bannerPreference)
  const title =
    preference === "always" || (preference === "auto" && hasLargeTerminal(context))
      ? VIBE_CHECK_BANNER
      : context.isTTY
        ? "VIBE CHECK"
        : "Vibe Check"

  return formatLines([
    title,
    "",
    "Shared feedback sessions for HTML and Markdown alternatives.",
    "",
    "Examples",
    "  vibe-check serve ./candidate-variants",
    "  vibe-check serve ./candidate-variants --json",
    "  vibe-check serve ./candidate-variants --tunnel cloudflare",
    "",
    "For agents",
    "  Run `vibe-check skill` to understand the tool.",
    "  Install Skill: npx skills add we-are-singular/vibe-check --skill vibe-check",
    "",
    "More help",
    "  vibe-check serve --help",
  ])
}

function resolveBannerPreference(value: string | undefined): "always" | "auto" | "never" {
  return value === "always" || value === "never" ? value : "auto"
}

function hasLargeTerminal(context: WelcomeContext): boolean {
  return context.isTTY && (context.columns ?? 0) >= 100 && (context.rows ?? 0) >= 22
}

function formatLines(lines: readonly string[]): string {
  return `${lines.join("\n")}\n\n`
}
