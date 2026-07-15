import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import { AgentSkill } from "../src/agent-skill.js"

describe("AgentSkill", () => {
  it("reads the installable Vibe Check skill", async () => {
    const contents = await new AgentSkill().contents()

    expect(contents).toBe(await readFile("../../skills/vibe-check/SKILL.md", "utf8"))
    expect(contents).toContain("name: vibe-check")
    expect(contents).toContain("## When to use this skill")
    expect(contents).toContain("asks for a **vibe check**")
    expect(contents).toContain("### Cloudflare Quick Tunnel")
    expect(contents).toContain("### ngrok")
  })
})
