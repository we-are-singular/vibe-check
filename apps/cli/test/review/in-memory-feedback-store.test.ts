import { InMemoryFeedbackStore } from "../../src/review/in-memory-feedback-store.js"

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

describe("InMemoryFeedbackStore", () => {
  it("counts Tinder feedback and replaces a changed opinion", async () => {
    const store = new InMemoryFeedbackStore(vibes)
    const loveSession = store.createOrResume()
    const keepSession = store.createOrResume()
    const passSession = store.createOrResume()

    await store.recordFeedback(loveSession.sessionId, "first", { kind: "tinder", vote: "love" })
    await store.recordFeedback(keepSession.sessionId, "first", { kind: "tinder", vote: "keep" })
    await store.recordFeedback(passSession.sessionId, "first", { kind: "tinder", vote: "pass" })
    await store.recordFeedback(loveSession.sessionId, "first", { kind: "tinder", vote: "pass" })

    expect(store.results().find(result => result.id === "first")).toMatchObject({
      keepCount: 1,
      loveCount: 0,
    })
  })

  it("persists completion when a reviewer skips Vibes", () => {
    const store = new InMemoryFeedbackStore(vibes)
    const session = store.createOrResume()

    expect(store.completeSession(session.sessionId)).toEqual({
      feedback: {},
      isComplete: true,
      sessionId: session.sessionId,
    })
    expect(store.createOrResume(session.sessionId).isComplete).toBe(true)
  })

  it("ranks star results by average rating", async () => {
    const store = new InMemoryFeedbackStore(vibes, { votingSystem: "stars" })
    const firstRater = store.createOrResume()
    const secondRater = store.createOrResume()

    expect(store.results()).toMatchObject([
      { averageRating: null, id: "first", ratingCount: 0, votingSystem: "stars" },
      { averageRating: null, id: "second", ratingCount: 0, votingSystem: "stars" },
    ])

    await store.recordFeedback(firstRater.sessionId, "first", { kind: "stars", rating: 5 })
    await store.recordFeedback(secondRater.sessionId, "first", { kind: "stars", rating: 3 })
    await store.recordFeedback(firstRater.sessionId, "second", { kind: "stars", rating: 5 })

    expect(store.results()).toMatchObject([
      { averageRating: 5, id: "second", ratingCount: 1, votingSystem: "stars" },
      { averageRating: 4, id: "first", ratingCount: 2, votingSystem: "stars" },
    ])
  })

  it("reports current non-empty comments separately from comment counts", async () => {
    const store = new InMemoryFeedbackStore(vibes, { votingSystem: "comment" })
    const session = store.createOrResume()

    await store.recordFeedback(session.sessionId, "first", { comment: "Strong opening.", kind: "comment" })

    expect(store.comments()).toEqual([
      {
        comment: "Strong opening.",
        sessionId: session.sessionId,
        vibe: { file: "first.html", id: "first", label: "First" },
      },
    ])
    expect(store.results()).toMatchObject([
      { commentCount: 1, id: "first", votingSystem: "comment" },
      { commentCount: 0, id: "second", votingSystem: "comment" },
    ])
  })

  it("journals accepted feedback before exposing it and skips matching retries", async () => {
    const recordAcceptedFeedback = vi.fn().mockResolvedValue(undefined)
    const store = new InMemoryFeedbackStore(vibes, { recordAcceptedFeedback })
    const session = store.createOrResume()

    await store.recordFeedback(session.sessionId, "first", { kind: "tinder", vote: "love" })
    await store.recordFeedback(session.sessionId, "first", { kind: "tinder", vote: "love" })
    await store.recordFeedback(session.sessionId, "first", { kind: "tinder", vote: "keep" })

    expect(recordAcceptedFeedback).toHaveBeenCalledTimes(2)
    expect(recordAcceptedFeedback).toHaveBeenLastCalledWith({
      eventId: `${session.sessionId}:first:2`,
      feedback: { kind: "tinder", vote: "keep" },
      sessionId: session.sessionId,
      vibe: { file: "first.html", id: "first", label: "First" },
    })

    const rejectedJournal = vi.fn().mockRejectedValue(new Error("disk full"))
    const uncommittedStore = new InMemoryFeedbackStore(vibes, { recordAcceptedFeedback: rejectedJournal })
    const uncommittedSession = uncommittedStore.createOrResume()

    await expect(
      uncommittedStore.recordFeedback(uncommittedSession.sessionId, "first", { kind: "tinder", vote: "keep" })
    ).rejects.toThrow("disk full")
    expect(uncommittedStore.getSession(uncommittedSession.sessionId).feedback).toEqual({})
  })
})
