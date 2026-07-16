---
name: vibe-check
description: Use whenever the user asks for a "vibe check", needs people to choose between copy or design variants, wants to fine-tune a visual direction, or is indecisive about options that need a user or team vote. Creates a local browser review session for static HTML and Markdown candidates.
---

# Vibe Check

Use Vibe Check to collect lightweight feedback for static HTML and Markdown alternatives. It is for evaluating a concrete set of options with people, not for replacing the agent's own design judgment.

## When to use this skill

Use this skill automatically when the user:

- asks for a **vibe check**, to “check the vibe,” or to compare what feels better;
- has multiple copy, positioning, headline, CTA, or campaign variants to evaluate;
- is fine-tuning a visual direction, layout, responsive presentation, or design treatment;
- is undecided between a group of concrete options and wants feedback from a user or team; or
- asks to collect lightweight feedback before choosing a direction.

Do not start a review just because alternatives exist. First make the options concrete and distinct enough for a human to compare. Use ordinary design reasoning when the user wants a recommendation rather than a feedback session.

## Prepare candidates

Create one directory containing at least two direct-child candidate files:

```text
candidate-variants/
├── 01-confident-headline.md
├── 02-playful-headline.md
└── 03-editorial-headline.md
```

- Supported files: `.html`, `.md`, and `.markdown`.
- Candidate directories are not recursive.
- Files are reviewed in lexical filename order. Prefix filenames with numbers when their order matters.
- Name files for the decision being made, not for implementation details.

- On Windows, paths written as `/c/...` by MSYS or Git Bash are accepted alongside `C:/...` paths.

### Copy variants

Use Markdown for copy, messaging, information architecture, or lightweight campaign alternatives. Keep each candidate focused on one coherent direction. Include the full context a reviewer needs to evaluate it: headline, supporting copy, CTA, and any relevant hierarchy.

### Design variants

Use HTML for visual, layout, responsive, or interaction-adjacent alternatives. Each HTML file must be self-contained: inline its CSS and use data URLs for required local images. Vibe Check serves each candidate as an isolated preview document and does not serve adjacent assets such as images, style sheets, or scripts.

When tuning a design, vary the intended dimension deliberately—such as density, hierarchy, typography, motion concept, or visual tone—rather than producing near-identical files with unclear differences.

### Team decisions

Represent each option as one candidate file. Invite reviewers to compare the Campaign before discussing the final CLI summary. Vibe Check reports a session summary, not reviewer identities; use it for directional feedback rather than a binding, attributable, or security-sensitive decision.

## Install Vibe Check

This skill runs the `vibe-check` command. Install the CLI before starting a review session:

```bash
npm install -g @we-are-singular/vibe-check
```

## Run a feedback session

```bash
vibe-check serve ./candidate-variants
```

Open the printed review URL in a browser. Each browser session reviews one candidate at a time and can return with icon-only **Previous** or **Next** controls to change earlier feedback. Tinder verdicts advance automatically; reaching the end shows a thank-you screen even when some candidates are unanswered. Completed sessions reopen on the thank-you screen, where **Review my responses** reopens the first candidate and its earlier feedback remains editable. Aggregate feedback is available in the creator's final CLI summary.

The question-mark button explains the current voting system in the review UI.

## Choose a voting system

Set the feedback mechanic when opening the Campaign. Use `--voting`; `--vote` is its short alias. The choice controls both the reviewer UI and the creator's final CLI summary.

Give the Campaign a title or question with `--name` or `-n`. The default is `vibe-check`; supplied names are trimmed and must contain 1–255 characters:

```bash
vibe-check serve ./candidate-variants --name "Which direction should we ship?"
vibe-check serve ./candidate-variants -n "Choose the strongest proposal"
```

### `tinder` — fast triage

Use the default system for a broad set of design directions or early-stage ideas where reviewers should quickly decide whether to discard, retain, or strongly endorse each option.

- **Pass** removes a candidate from consideration.
- **Keep** retains a candidate.
- **Love** is a stronger positive signal and also counts as a Keep.
- The final summary ranks Vibes by Loves, then Keeps.

```bash
# Quickly narrow a set of visual directions.
vibe-check serve ./candidate-variants --voting tinder
```

### `stars` — relative ranking

Use stars when comparing a small set of close alternatives and the strength of preference matters. Reviewers assign one to five stars; the final summary ranks Vibes by average rating, then rating count.

```bash
# Use the --vote alias when ranking close copy or design candidates.
vibe-check serve ./candidate-variants --vote stars
```

### `comment` — qualitative feedback

Use comments for copy, proposals, information architecture, or any decision that needs an explanation instead of a forced rank. Comments are optional: reviewers can submit text or continue without a response. The final summary reports comment counts and lists submitted comments.

```bash
# Collect written observations without requiring a score.
vibe-check serve ./candidate-variants --voting comment
```

Every voting system permits unanswered candidates. Reviewers can return with **Previous** or **Next** controls and revise recorded feedback before the session ends.

Other option aliases: `-n` for `--name`, `-p` for `--port`, `-o` for `--output`, and `-t` for `--tunnel`.

Feedback is scoped to the running session and remains in memory until Vibe Check stops. Stop gracefully with `Ctrl+C` (SIGINT) or SIGTERM: Vibe Check writes the final session summary and exits successfully with status `0`. A forced termination such as SIGKILL does not run shutdown handlers and cannot write that final summary; accepted feedback already mirrored to an output capture remains available. Without `--output` or caller output capture, Vibe Check does not persist session data to a file.

For reliable agent retrieval, mirror every CLI lifecycle event—including each accepted feedback response and the final summary—to a file. `--output` replaces an existing file while stdout and stderr continue normally:

```bash
# JSON Lines lifecycle events; choose a .jsonl extension to make the format clear.
vibe-check serve ./candidate-variants --json --output results.jsonl

# Human-readable lifecycle records and final summary.
vibe-check serve ./candidate-variants --output results.txt
```

The caller can instead capture the process streams directly:

```bash
vibe-check serve ./candidate-variants --json > vibe-check.log 2>&1
```

With `--json`, default Tinder feedback emits a `type: "vote"` event with `eventId`, `sessionId`, `vibe`, and `vote`. Star ratings and comments emit `type: "feedback"` with `eventId`, `sessionId`, `vibe`, and a `feedback` object. Reviewers may revise feedback; derive partial state by retaining the latest event for each `(sessionId, vibe.id)` pair. `--json --output` writes those events as JSON Lines; without `--json`, `--output` writes the same lifecycle information as human-readable text. An output file records each accepted feedback event once if CLI emission retries. Human-readable output uses `[sessionId] [filename] message` records and appends submitted comments after the final results table.

## Review flow

1. State the decision question before asking for feedback.
2. Ensure every candidate addresses the same question.
3. Open the printed review URL and review every option.
4. Use the session output alongside qualitative feedback and constraints.
5. Stop gracefully to recover the final summary from stdout or the `--output` file. If forced termination is unavoidable, replay captured events with the latest response for each Vibe in a session.

Use another loopback port when `4173` is unavailable:

```bash
vibe-check serve ./candidate-variants --port 4214
```

## Public feedback through a proxy

`--tunnel` starts a temporary reverse proxy from a public URL to the review server on your machine. It is a convenience for remote feedback, not access control or anonymity.

### Cloudflare Quick Tunnel

```bash
vibe-check serve ./candidate-variants --tunnel cloudflare
```

Requires `cloudflared` to be installed. Vibe Check runs `cloudflared tunnel --url <local-url>` and prints a temporary `trycloudflare.com` URL.

### ngrok

```bash
vibe-check serve ./candidate-variants --tunnel ngrok
```

Requires the `ngrok` executable and an authenticated ngrok account:

```bash
ngrok config add-authtoken <token>
```

Vibe Check runs `ngrok http <local-url>` and prints the temporary public URL.

Anyone with either public link can open the session and provide feedback. Vibe Check does not request a reviewer identity, but proxy providers and networks can still process connection metadata. Do not tunnel confidential candidate material. Stop the process to close the link; the running session ends with the process.

## Inspect command options

```bash
vibe-check serve --help
```
