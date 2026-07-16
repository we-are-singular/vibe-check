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
  it("counts Love as both a Love and a Keep while omitting Pass", async () => {
    const store = new InMemoryVoteStore(vibes)
    const loveSession = store.createOrResume()
    const keepSession = store.createOrResume()
    const passSession = store.createOrResume()

    await store.recordVote(loveSession.sessionId, "first", "love")
    await store.recordVote(keepSession.sessionId, "first", "keep")
    await store.recordVote(passSession.sessionId, "first", "pass")

    const first = store.results().find(result => result.id === "first")
    const second = store.results().find(result => result.id === "second")

    expect(first).toMatchObject({ keepCount: 2, loveCount: 1 })
    expect(second).toMatchObject({ keepCount: 0, loveCount: 0 })
  })

  it("journals each accepted vote before making it visible", async () => {
    const recordAcceptedVote = vi.fn().mockResolvedValue(undefined)
    const store = new InMemoryVoteStore(vibes, recordAcceptedVote)
    const session = store.createOrResume()

    await store.recordVote(session.sessionId, "first", "love")
    await store.recordVote(session.sessionId, "first", "love")

    expect(recordAcceptedVote).toHaveBeenCalledTimes(1)
    expect(recordAcceptedVote).toHaveBeenCalledWith({
      sessionId: session.sessionId,
      vibe: { file: "first.html", id: "first", label: "First" },
      vote: "love",
    })

    const rejectedJournal = vi.fn().mockRejectedValue(new Error("disk full"))
    const uncommittedStore = new InMemoryVoteStore(vibes, rejectedJournal)
    const uncommittedSession = uncommittedStore.createOrResume()

    await expect(uncommittedStore.recordVote(uncommittedSession.sessionId, "first", "keep")).rejects.toThrow(
      "disk full"
    )
    expect(uncommittedStore.getSession(uncommittedSession.sessionId).votes).toEqual({})
  })
})
