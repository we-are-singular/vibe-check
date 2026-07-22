# Vibe Check

Share feedback on static HTML and Markdown alternatives with an agent, a teammate, or a wider group.

## Install

Vibe Check runs through npm on Windows, macOS, and Linux. Requires Node.js 22 or newer and npm 11 or newer.

```bash
npm install -g @we-are-singular/vibe-check
```

### Install the agent skill

Make Vibe Check available to compatible coding agents:

```bash
npx skills add we-are-singular/vibe-check
```

The package scope identifies its publisher. The installed command remains `vibe-check`.

## Quick start

Put at least two candidate files directly in one directory:

```text
candidate-variants/
├── 01-home.html
├── 02-mobile.html
└── 03-pricing.md
```

Start a review session:

```bash
vibe-check serve ./candidate-variants
```

Open the printed review URL. It starts on your machine and can be shared with `--tunnel`. The default `love` mechanic offers **Pass**, **Keep**, and **Love**; selecting one advances to the next candidate. Use the icon-only **Previous** and **Next** controls to revisit candidates; previously recorded feedback stays selected and can be changed. Reaching the end shows a thank-you screen; the Campaign owner receives aggregate feedback in the final CLI session summary.

Feedback is scoped to the running session and stays in memory until the server stops. Completed sessions reopen on their thank-you screen; **Review my responses** replaces the progress label in the header and reopens the first candidate. Stop gracefully with `Ctrl+C` (SIGINT) or SIGTERM: Vibe Check writes the final summary and exits with status `0`. A forced termination such as SIGKILL cannot write that shutdown summary, but accepted feedback already emitted to an output capture remains available. Without `--output` or caller output capture, Vibe Check does not persist session data to a file.

## Campaign files

- Include at least two direct-child `.html`, `.md`, or `.markdown` files. Vibe Check does not search nested directories.
- HTML and Markdown files may be mixed.
- Files are reviewed in lexical filename order. Prefix names with numbers, such as `01-home.html` and `02-mobile.md`, when order matters.
- HTML candidates should be self-contained. Vibe Check serves each file as an isolated preview document; it does not serve adjacent assets such as images, style sheets, or scripts.
- On Windows, MSYS or Git Bash paths written as `/c/...` are accepted alongside `C:/...`.

## Options

Choose a voting mechanic when starting the Campaign:

Name the Campaign with a title or review question using `--name` or `-n`. The default title is `What do you think?`; supplied names are trimmed and must contain 1–255 characters:

```bash
vibe-check serve ./candidate-variants --name "Which landing page is clearest?"
vibe-check serve ./candidate-variants -n "Choose the strongest draft"
```

```bash
# Default: Pass, Keep, or Love; the CLI summary ranks Loves, then Keeps.
vibe-check serve ./candidate-variants --voting love

# One-to-five star ratings; the CLI summary ranks average rating.
vibe-check serve ./candidate-variants --voting stars

# Optional written feedback; the CLI summary reports and lists submitted comments.
vibe-check serve ./candidate-variants --voting comment
```

All voting systems allow unanswered candidates. Unrated Vibes show no star average, while a comment is recorded only when text is submitted.

Use another loopback port when `4173` is unavailable:

```bash
vibe-check serve ./candidate-variants --port 4214
```

Short aliases: `--vote` for `--voting`, `-n` for `--name`, `-p` for `--port`, `-o` for `--output`, and `-t` for `--tunnel`.

Emit newline-delimited JSON lifecycle events for automation:

```bash
vibe-check serve ./candidate-variants --json
```

For reliable agent or process retrieval, mirror every CLI lifecycle event—including each accepted feedback response and the final summary—to a file. `--output` replaces an existing file while stdout and stderr continue normally. With `--json`, the file is JSON Lines; without `--json`, it is human-readable text:

```bash
vibe-check serve ./candidate-variants --json --output results.jsonl
vibe-check serve ./candidate-variants --output results.txt
```

The caller can instead capture the process streams directly:

```bash
vibe-check serve ./candidate-variants --json > vibe-check.log 2>&1
```

With `--json`, default Love feedback emits `type: "vote"` with `eventId`, `sessionId`, `vibe`, and `vote`. Star ratings and comments emit `type: "feedback"` with `eventId`, `sessionId`, `vibe`, and a `feedback` object. Reviewers may change their feedback; when replaying captured events, keep the latest event for each `(sessionId, vibe.id)` pair. An output file records each accepted feedback event once if CLI emission retries. In human-readable mode, accepted feedback uses `[sessionId] [filename] message` records; final comment summaries list each submitted comment after the results table. For Love summaries, **Kept or loved** includes every Keep and Love response.

Share a temporary public review link through an installed tunnel provider:

```bash
vibe-check serve ./candidate-variants --tunnel cloudflare
vibe-check serve ./candidate-variants --tunnel ngrok
```

The corresponding provider executable must be installed and configured before using `--tunnel`. Anyone with a public link can participate in the session. Vibe Check does not ask participants to identify themselves, but a tunnel provider, browser, or network may still process connection metadata. Stop the process to close the link; the running session ends with the process.

## Agent skill

Run the built-in guide to understand Vibe Check's workflow:

```bash
vibe-check skill
```

Install the skill directly with the Skills CLI:

```bash
npx skills add we-are-singular/vibe-check
```

Or print it first and confirm the installation from Vibe Check:

```bash
vibe-check skill --install
```

## Help

```bash
vibe-check serve --help
```
