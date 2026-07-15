# Vibe Check

Review static HTML and Markdown alternatives in a local browser-based voting session.

## Install

Requires Node.js 22 or newer.

```bash
npm install -g vibe-check
```

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

Open the local URL printed by the command. Review each candidate and choose **Pass**, **Keep**, or **Love**. After you vote on every candidate, Vibe Check shows ranked results for the session.

Votes exist only in memory. Press `Ctrl+C` to stop the server; Vibe Check prints aggregate results and discards all votes.

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

Share a temporary public review link through an installed tunnel provider:

```bash
vibe-check serve ./candidate-variants --tunnel cloudflare
vibe-check serve ./candidate-variants --tunnel ngrok
```

The corresponding provider executable must be installed and configured before using `--tunnel`. Anyone with a public link can open the session and submit votes. Vibe Check does not ask voters to identify themselves, but a tunnel provider, browser, or network may still process connection metadata. Stop the process to close the link and discard its votes.

## Agent skill

Vibe Check ships an agent skill for AI-assisted campaign reviews.

```bash
vibe-check skill
```

To install it with the Skills CLI, let Vibe Check ask for confirmation before it runs:

```bash
vibe-check skill --install
```

The installer runs `npx skills add we-are-singular/vibe-check --skill vibe-check` only after you confirm.

## Development

Requirements: Node.js 22+ and npm 11+.

```bash
npm install
npm run typecheck
npm test
npm run build
```

For development, `dev` rebuilds the viewer and watches both the viewer and CLI source:

```bash
npm run dev -- serve ./candidate-variants
```

This is rebuild-on-save, not HMR. The CLI always serves the current `dist/viewer` output.

## Project structure

- `apps/cli` — the published Clipanion CLI, Hono review server, React viewer, and tunnel providers.
- `demo` — example candidate directories for local review.
- `PRD.md` and `CONTEXT.md` — product requirements and canonical domain language.

## Help

```bash
vibe-check serve --help
```
