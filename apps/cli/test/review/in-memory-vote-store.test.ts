import { describe, expect, it } from "vitest"
import { InMemoryVoteStore } from "../../src/review/in-memory-vote-store.js"

const vibes = [
  {
    file: "first.html",
    preview: {
      content: "<!doctype html><title>First</title>",
      kind: "html",
    },
    id: "first",
    label: "First",
  },
  {
    file: "second.html",
    preview: {
      content: "<!doctype html><title>Second</title>",
      kind: "html",
    },
    id: "second",
    label: "Second",
  },
] as const

describe("InMemoryVoteStore results", () => {
  it("counts Love as both a Love and a Keep while omitting Pass", () => {
    const store = new InMemoryVoteStore(vibes)
    const loveSession = store.createOrResume()
    const keepSession = store.createOrResume()
    const passSession = store.createOrResume()

    store.recordVote(loveSession.sessionId, "first", "love")
    store.recordVote(keepSession.sessionId, "first", "keep")
    store.recordVote(passSession.sessionId, "first", "pass")

    const first = store.results().find(result => result.id === "first")
    const second = store.results().find(result => result.id === "second")

    expect(first).toMatchObject({ keepCount: 2, loveCount: 1 })
    expect(second).toMatchObject({ keepCount: 0, loveCount: 0 })
  })
})
