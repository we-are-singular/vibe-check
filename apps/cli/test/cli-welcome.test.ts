import { formatWelcomeScreen } from "../src/cli-welcome.js"

describe("formatWelcomeScreen", () => {
  it("uses a plain title but preserves the full help screen for non-interactive output", () => {
    const output = formatWelcomeScreen({ isTTY: false })

    expect(output.startsWith("Vibe Check\n")).toBe(true)
    expect(output).toContain("Examples")
    expect(output).toContain("For agents")
    expect(output).toContain("  Run `vibe-check skill` to understand the tool.")
    expect(output).toContain("vibe-check serve ./candidate-variants --json --output vibe-check.log")
    expect(output).not.toContain("░██")
  })

  it("uses the literal title in a small terminal", () => {
    const output = formatWelcomeScreen({ columns: 80, isTTY: true, rows: 24 })

    expect(output.startsWith("VIBE CHECK\n")).toBe(true)
    expect(output).toContain("For agents")
    expect(output).not.toContain("░██")
    expect(output.endsWith("\n\n")).toBe(true)
  })

  it("uses the full banner in a terminal at least 100 by 22", () => {
    const output = formatWelcomeScreen({ columns: 100, isTTY: true, rows: 22 })

    expect(output).toContain("░██")
    expect(output).toContain("For agents")
    expect(output).toContain("Install Skill: npx skills add we-are-singular/vibe-check")
  })

  it("honors the always and never banner overrides", () => {
    expect(formatWelcomeScreen({ bannerPreference: "always", isTTY: false })).toContain("░██")
    expect(formatWelcomeScreen({ bannerPreference: "never", columns: 120, isTTY: true, rows: 30 })).not.toContain("░██")
  })
})
