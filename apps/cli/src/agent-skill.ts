import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SKILLS_INSTALL_COMMAND = ["skills", "add", "we-are-singular/vibe-check"] as const

/** Reads the agent skill shipped beside the CLI and from the source checkout. */
export class AgentSkill {
  constructor(private readonly filePath = resolveSkillPath()) {}

  async contents(): Promise<string> {
    return readFile(this.filePath, "utf8")
  }
}

/** Formats the manual command for installing the published Vibe Check skill. */
export function formatSkillInstallInstructions(): string {
  return `\nInstall the skill with:\n\n  npx ${SKILLS_INSTALL_COMMAND.join(" ")}\n`
}

function resolveSkillPath(): string {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url))
  const installedSkillPath = resolve(moduleDirectory, "..", "skills", "vibe-check", "SKILL.md")
  const sourceSkillPath = resolve(moduleDirectory, "..", "..", "..", "skills", "vibe-check", "SKILL.md")

  return existsSync(installedSkillPath) ? installedSkillPath : sourceSkillPath
}
