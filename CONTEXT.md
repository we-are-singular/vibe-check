# Vibe Check

Vibe Check names the domain concepts for evaluating self-contained creative candidates through individual human judgments and an aggregate result. This glossary establishes precise language for candidates, participation, judgments, and aggregation while keeping a Vibe distinct from the artifact that represents its source.

## Language

**Vibe**:
One immutable creative candidate presented for human judgment.
_Avoid_: option, variant. Use _artifact_ only for a Vibe's source representation, not for the domain object itself.

**Artifact**:
The direct-child source representation of a **Vibe** in the current CLI: self-contained HTML or Markdown (`.md` or `.markdown`). Markdown disables raw HTML and renders as sandboxed prose.

**Campaign**:
One fixed collection of Vibes evaluated together under one prompt.
_Avoid_: poll, survey, test.

**Creator**:
A human or agent responsible for assembling and opening a Campaign.

**Voter**:
A human who judges the Vibes in a Campaign.

**Voter Session**:
One Voter's attempt to review one Campaign.

**Verdict**:
`pass`, `keep`, or `love`, expressing one Voter's judgment of one Vibe. `love` is the stronger positive **I love it** signal: it counts as a keep and adds a Love.

**Campaign Result**:
The aggregate Loves and Keeps derived from recorded Voter Session Verdicts.

## Relationships

- A **Creator** opens a **Campaign**.
- A **Campaign** contains two or more **Vibes**.
- A **Voter** undertakes a **Voter Session**.
- A **Voter Session** records exactly one **Verdict** per **Vibe**.
- A **Campaign Result** sorts Vibes by Loves first, then Keeps.

## Example dialogue

> **Dev:** "Does choosing **I love it** also increment Keeps?"
>
> **Domain expert:** "Yes. A **love** is a keep with extra emphasis, so it increments both Loves and Keeps. Results sort Loves first and Keeps second."

## Flagged ambiguities

- “vibe” names the creative candidate regardless of source format, while static HTML is only the validation representation.
- “vote” is avoided because it ambiguously means a per-Vibe **Verdict** or the aggregate **Campaign Result**.
