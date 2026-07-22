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

**Voting System**:
The feedback mechanic selected by the Creator when opening a Campaign: `love` (the default), `stars`, or `comment`.

**Verdict**:
For the `love` Voting System only: `pass`, `keep`, or `love`. `love` is the stronger positive **I love it** signal: it counts as a keep and adds a Love.

**Star Rating**:
For the `stars` Voting System only: one to five stars expressing a Voter's relative ranking of one Vibe.

**Comment**:
For the `comment` Voting System only: optional written feedback on one Vibe. A Voter can continue without creating a Comment.

**Feedback**:
An optional Voter response for one Vibe, using the Campaign's Voting System. A Voter can leave any Vibe unanswered.

**Campaign Result**:
The aggregate result derived from recorded Voter Session Feedback. Love Campaigns sort by Loves then Keeps; star Campaigns sort by average rating; comment Campaigns report comment counts without a ranking.

## Relationships

- A **Creator** opens a **Campaign** with one Voting System.
- A **Campaign** contains two or more **Vibes**.
- A **Voter** undertakes a **Voter Session**.
- A **Voter Session** retains at most one current **Feedback** response per **Vibe**.
- A **Campaign Result** aggregates Feedback according to its Voting System.

## Example dialogue

> **Dev:** "Does choosing **I love it** also increment Keeps?"
>
> **Domain expert:** "Yes. A **love** is a keep with extra emphasis, so it increments both Loves and Keeps. Results sort Loves first and Keeps second."

## Flagged ambiguities

- “vibe” names the creative candidate regardless of source format, while static HTML is only the validation representation.
- “vote” is avoided because it ambiguously means a per-Vibe **Verdict** or the aggregate **Campaign Result**.
