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

### Copy variants

Use Markdown for copy, messaging, information architecture, or lightweight campaign alternatives. Keep each candidate focused on one coherent direction. Include the full context a reviewer needs to evaluate it: headline, supporting copy, CTA, and any relevant hierarchy.

### Design variants

Use HTML for visual, layout, responsive, or interaction-adjacent alternatives. Each HTML file must be self-contained: inline its CSS and use data URLs for required local images. Vibe Check serves each candidate as an isolated preview document and does not serve adjacent assets such as images, style sheets, or scripts.

When tuning a design, vary the intended dimension deliberately—such as density, hierarchy, typography, motion concept, or visual tone—rather than producing near-identical files with unclear differences.

### Team decisions

Represent each option as one candidate file. Ask reviewers to complete the full review before discussing results. Vibe Check reports a session summary, not reviewer identities; use it for directional feedback rather than a binding, attributable, or security-sensitive decision.

## Run a local review

```bash
vibe-check serve ./candidate-variants
```

Open the printed loopback URL in a browser. Each browser session reviews one candidate at a time and provides feedback for each. Results appear after that session has reviewed every candidate.

Feedback exists only in memory. Press `Ctrl+C` to stop Vibe Check, print the session summary, and discard all feedback.

## Review flow

1. State the decision question before asking for feedback.
2. Ensure every candidate addresses the same question.
3. Open the local URL and review every option.
4. Use the session output alongside qualitative feedback and constraints.
5. Stop the process when the session ends; its feedback cannot be recovered.

Use another loopback port when `4173` is unavailable:

```bash
vibe-check serve ./candidate-variants --port 4214
```

## Public feedback through a proxy

`--tunnel` starts a temporary reverse proxy from a public URL to the local review server. It is convenience for remote feedback, not access control or anonymity.

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

Anyone with either public link can open the session and provide feedback. Vibe Check does not request a reviewer identity, but proxy providers and networks can still process connection metadata. Do not tunnel confidential candidate material. Stop the process to close the link and discard its feedback.

## Inspect command options

```bash
vibe-check serve --help
```
