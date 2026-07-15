import { Builtins, Cli, type BaseContext } from "clipanion"
import packageJson from "../package.json" with { type: "json" }
import { formatWelcomeScreen } from "./cli-welcome.js"
import { ServeCommand } from "./commands/serve.command.js"
import { SkillCommand } from "./commands/skill.command.js"

/**
 * Clipanion includes internal positional placeholders such as `#0` in option
 * help. The executable presents the user-facing option name instead.
 */
class VibeCheckCli<Context extends BaseContext> extends Cli<Context> {
  usage(command?: Parameters<Cli<Context>["usage"]>[0], options?: Parameters<Cli<Context>["usage"]>[1]): string {
    const usage = super.usage(command, options).replace(/ #\d+/g, "")
    if (command !== undefined) return usage

    return formatWelcomeScreen({
      bannerPreference: process.env.VIBE_CHECK_BANNER,
      columns: process.stdout.columns,
      isTTY: process.stdout.isTTY,
      rows: process.stdout.rows,
    })
  }

  error(error: Error, options?: Parameters<Cli<Context>["error"]>[1]): string {
    return super.error(error, options).replace(/ #\d+/g, "")
  }
}

const cli = new VibeCheckCli({
  binaryLabel: "Vibe Check",
  binaryName: "vibe-check",
  binaryVersion: packageJson.version,
})

cli.register(Builtins.HelpCommand)
cli.register(Builtins.VersionCommand)
cli.register(ServeCommand)
cli.register(SkillCommand)

cli.runExit(process.argv.slice(2))
