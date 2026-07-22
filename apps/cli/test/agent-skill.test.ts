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
    expect(contents).toContain("--vote stars")
    expect(contents).toContain("--voting comment")
    expect(contents).toContain("## Choose a voting system")
    expect(contents).toContain("### `love` — fast triage")
    expect(contents).toContain("### `stars` — relative ranking")
    expect(contents).toContain("### `comment` — qualitative feedback")
    expect(contents).toContain("--vote stars")
    expect(contents).toContain("exits successfully with status `0`")
    expect(contents).toContain("SIGKILL does not run shutdown handlers")
    expect(contents).toContain("--json --output results.jsonl")
    expect(contents).toContain(
      "without `--json`, `--output` writes the same lifecycle information as human-readable text"
    )
    expect(contents).toContain("paths written as `/c/...` by MSYS or Git Bash are accepted")
  })
})

describe("formatSkillInstallInstructions", () => {
  it("prints the repository installation command", () => {
    expect(formatSkillInstallInstructions()).toBe(
      "\nInstall the skill with:\n\n  npx skills add we-are-singular/vibe-check\n"
    )
  })
})
