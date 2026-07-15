import { spawn } from "node:child_process"
import { createInterface } from "node:readline/promises"
import { Command, Option } from "clipanion"
import { AgentSkill } from "../agent-skill.js"
import { VibeCheckCommand } from "../vibe-check-command.js"

const SKILLS_INSTALL_COMMAND = ["skills", "add", "we-are-singular/vibe-check", "--skill", "vibe-check"] as const

/** Prints the agent skill and can hand control to the Skills CLI for installation. */
export class SkillCommand extends VibeCheckCommand {
  static paths = [["skill"]]

  static usage = Command.Usage({
    description: "Print the Vibe Check agent skill",
    details: "Use --install to confirm and then run the Skills CLI installer for the public Vibe Check repository.",
    examples: [
      ["Print the skill", "vibe-check skill"],
      ["Install the skill", "vibe-check skill --install"],
    ],
  })

  install = Option.Boolean("--install", {
    description: "Confirm and run npx skills add we-are-singular/vibe-check --skill vibe-check",
    required: false,
  })

  async execute(): Promise<number> {
    try {
      this.context.stdout.write(await new AgentSkill().contents())
    } catch (error) {
      this.output({ type: "error", message: `unable to read agent skill: ${getErrorMessage(error)}` })
      return 1
    }

    if (!this.install) return 0
    if (!isInteractiveTerminal(this.context.stdin)) {
      this.context.stderr.write("error: --install requires an interactive terminal.\n")
      return 1
    }

    const prompt = createInterface({ input: this.context.stdin, output: this.context.stdout })
    try {
      const response = await prompt.question(`Run npx ${SKILLS_INSTALL_COMMAND.join(" ")}? [y/N] `)
      if (!isConfirmation(response)) {
        this.context.stdout.write("Installation cancelled.\n")
        return 0
      }
    } finally {
      prompt.close()
    }

    return installSkill()
  }
}

function isInteractiveTerminal(stream: NodeJS.ReadableStream): boolean {
  return "isTTY" in stream && stream.isTTY === true
}

function isConfirmation(value: string): boolean {
  return /^(y|yes)$/i.test(value.trim())
}

async function installSkill(): Promise<number> {
  const child = spawn("npx", SKILLS_INSTALL_COMMAND, { stdio: "inherit" })
  const { promise, reject, resolve } = Promise.withResolvers<number>()

  child.once("error", reject)
  child.once("exit", code => resolve(code ?? 1))

  return promise
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
