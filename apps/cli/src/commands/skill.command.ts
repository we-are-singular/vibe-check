import { Command, Option } from "clipanion"
import { AgentSkill, formatSkillInstallInstructions } from "../agent-skill.js"
import { VibeCheckCommand } from "../vibe-check-command.js"

/** Prints the agent skill and its manual Skills CLI installation command. */
export class SkillCommand extends VibeCheckCommand {
  static paths = [["skill"]]

  static usage = Command.Usage({
    description: "Print the Vibe Check agent skill",
    details: "Use --install to print the Skills CLI command for installing the public Vibe Check skill.",
    examples: [
      ["Print the skill", "vibe-check skill"],
      ["Install the skill", "vibe-check skill --install"],
    ],
  })

  install = Option.Boolean("--install", {
    description: "Print the command for installing the Vibe Check skill with the Skills CLI",
    required: false,
  })

  async execute(): Promise<number> {
    try {
      this.context.stdout.write(await new AgentSkill().contents())
    } catch (error) {
      await this.output({ type: "error", message: `unable to read agent skill: ${getErrorMessage(error)}` })
      return 1
    }

    if (this.install) {
      this.context.stdout.write(formatSkillInstallInstructions())
    }

    return 0
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
