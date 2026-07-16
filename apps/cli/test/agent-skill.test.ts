import { readFile } from "node:fs/promises"

import { AgentSkill, formatSkillInstallInstructions } from "../src/agent-skill.js"

describe("AgentSkill", () => {
  it("reads the installable Vibe Check skill", async () => {
    const contents = await new AgentSkill().contents()

    expect(contents).toBe(await readFile("../../skills/vibe-check/SKILL.md", "utf8"))
    expect(contents).toContain("name: vibe-check")
    expect(contents).toContain("## When to use this skill")
    expect(contents).toContain("asks for a **vibe check**")
    expect(contents).toContain("### Cloudflare Quick Tunnel")
    expect(contents).toContain("### ngrok")
    expect(contents).toContain("npm install -g @we-are-singular/vibe-check")
    expect(contents).toContain("--json --output vibe-check.log")
    expect(contents).toContain("any accepted feedback already emitted to an output capture remains available.")
    expect(contents).toContain("--voting stars")
    expect(contents).toContain("--voting comment")
  })
})

describe("formatSkillInstallInstructions", () => {
  it("prints the repository installation command", () => {
    expect(formatSkillInstallInstructions()).toBe(
      "\nInstall the skill with:\n\n  npx skills add we-are-singular/vibe-check\n"
    )
  })
})
