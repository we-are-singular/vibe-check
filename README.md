# Vibe Check

Share feedback on static HTML and Markdown alternatives with an agent, a teammate, or a wider group.

## Install

Vibe Check runs through npm on Windows, macOS, and Linux. Requires Node.js 22 or newer and npm 11 or newer.

```bash
npm install -g @we-are-singular/vibe-check
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

Open the printed review URL. It starts on your machine and can be shared with `--tunnel`. Review each candidate and give feedback with **Pass**, **Keep**, or **Love**. After you respond to every candidate, Vibe Check shows the session results.

Feedback is scoped to the running session and stays in memory until the server stops. Press `Ctrl+C` when the review is over; Vibe Check prints the session summary but does not persist the session data.

## Campaign files

- Include at least two direct-child `.html`, `.md`, or `.markdown` files. Vibe Check does not search nested directories.
- HTML and Markdown files may be mixed.
- Files are reviewed in lexical filename order. Prefix names with numbers, such as `01-home.html` and `02-mobile.md`, when order matters.
- HTML candidates should be self-contained. Vibe Check serves each file as an isolated preview document; it does not serve adjacent assets such as images, style sheets, or scripts.

## Options

Use another loopback port when `4173` is unavailable:

```bash
vibe-check serve ./candidate-variants --port 4214
```

Emit newline-delimited JSON lifecycle events for automation:

```bash
vibe-check serve ./candidate-variants --json
```

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
npx skills add we-are-singular/vibe-check --skill vibe-check
```

Or print it first and confirm the installation from Vibe Check:

```bash
vibe-check skill --install
```

## Development

Requirements: Node.js 22+ and npm 11.18.0.

```bash
npm install
npm run typecheck
npm test
npm run test:coverage
npm run build
```

For development, `dev` rebuilds the viewer and watches both the viewer and CLI source:

```bash
npm run dev -- serve ./candidate-variants
```

This is rebuild-on-save, not HMR. The CLI always serves the current `dist/viewer` output.

## Project structure

- `apps/cli` — the published Clipanion CLI, Hono review server, React viewer, and tunnel providers.
- `demo` — example candidate directories.
- `CONTEXT.md` — canonical domain language.

## Help

```bash
vibe-check serve --help
```
