import { ArrowUpRight, ChevronLeft, ChevronRight, CircleHelp, Heart } from "lucide-react"
import { useEffect, useState } from "react"
import { PreviewModePicker, isPreviewMode, type PreviewMode } from "./preview-mode-picker.js"
import { ReviewApiClient, type Campaign, type ReviewSession } from "./api.js"
import type { Feedback } from "../../types.js"
import { getErrorMessage } from "../../utils.js"
import { VibePreview } from "./vibe-preview.js"
import { VotingControls } from "./voting-controls.js"
import { VotingHelpDialog } from "./voting-help-dialog.js"

const defaultApi = new ReviewApiClient()

type ViewerState =
  | { kind: "loading" }
  | { error: string; kind: "error" }
  | { campaign: Campaign; kind: "reviewing"; session: ReviewSession }
  | { campaign: Campaign; kind: "complete"; session: ReviewSession }
  | { kind: "thank-you" }
type ViewerAppProps = {
  api?: ReviewApiClient
}

/** Owns the browser review workflow, local preferences, and feedback submission UI. */
export function ViewerApp({ api = defaultApi }: ViewerAppProps): React.JSX.Element {
  const [previewMode, setPreviewMode] = useState<PreviewMode>(() => {
    if (typeof window === "undefined") return "full"
    try {
      const storedMode = window.localStorage.getItem("vibe-check:preview-width")
      return isPreviewMode(storedMode) ? storedMode : "full"
    } catch {
      return "full"
    }
  })
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [reloadGeneration, setReloadGeneration] = useState(0)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [saveError, setSaveError] = useState<string | undefined>()
  const [isSaving, setIsSaving] = useState(false)
  const [viewerState, setViewerState] = useState<ViewerState>({ kind: "loading" })

  useEffect(() => {
    let ignored = false

    const initialize = async (): Promise<void> => {
      if (window.location.pathname === "/results") {
        setViewerState({ kind: "thank-you" })
        return
      }

      setViewerState({ kind: "loading" })
      try {
        let storedSessionId: string | undefined
        try {
          storedSessionId = window.localStorage.getItem("vibe-check:session") ?? undefined
        } catch {
          // Session recovery is optional when the browser restricts local storage.
        }

        const [campaign, session] = await Promise.all([api.getCampaign(), api.createOrResumeSession(storedSessionId)])

        if (campaign.vibes.length === 0) {
          throw new Error("This campaign has no Vibes to review.")
        }

        try {
          window.localStorage.setItem("vibe-check:session", session.sessionId)
        } catch {
          // The current in-memory session remains usable when storage is restricted.
        }

        if (ignored) return
        setCommentDrafts(getCommentDrafts(session))

        if (session.isComplete) {
          if (!ignored) setViewerState({ campaign, kind: "complete", session })
          return
        }

        const firstIncompleteIndex = campaign.vibes.findIndex(vibe => session.feedback[vibe.id] === undefined)
        setCurrentIndex(firstIncompleteIndex === -1 ? campaign.vibes.length - 1 : firstIncompleteIndex)
        setViewerState({ campaign, kind: "reviewing", session })
      } catch (error) {
        if (!ignored) setViewerState({ error: getErrorMessage(error), kind: "error" })
      }
    }

    void initialize()
    return () => {
      ignored = true
    }
  }, [api, reloadGeneration])

  const retry = (): void => {
    setReloadGeneration(current => current + 1)
  }

  const changePreviewMode = (mode: PreviewMode): void => {
    setPreviewMode(mode)
    try {
      window.localStorage.setItem("vibe-check:preview-width", mode)
    } catch {
      // An in-memory preference still improves the current review session.
    }
  }

  const finishOrAdvance = async (campaign: Campaign, session: ReviewSession): Promise<void> => {
    if (currentIndex < campaign.vibes.length - 1) {
      setSaveError(undefined)
      setCurrentIndex(index => Math.min(campaign.vibes.length - 1, index + 1))
      setViewerState({ campaign, kind: "reviewing", session })
      return
    }

    setIsSaving(true)
    setSaveError(undefined)
    try {
      const completedSession = await api.completeSession(session.sessionId)
      setViewerState({ campaign, kind: "complete", session: completedSession })
    } catch (error) {
      setSaveError(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const saveFeedback = async (feedback: Feedback, advance = false): Promise<ReviewSession | undefined> => {
    if (viewerState.kind !== "reviewing" || isSaving) return undefined

    const { campaign, session } = viewerState
    const vibe = campaign.vibes[currentIndex]
    if (!vibe) return undefined

    setIsSaving(true)
    setSaveError(undefined)
    try {
      const updatedSession = await api.recordFeedback({
        feedback,
        sessionId: session.sessionId,
        vibeId: vibe.id,
      })
      if (advance) {
        await finishOrAdvance(campaign, updatedSession)
      } else {
        setViewerState({ campaign, kind: "reviewing", session: updatedSession })
      }
      return updatedSession
    } catch (error) {
      setSaveError(getErrorMessage(error))
      return undefined
    } finally {
      setIsSaving(false)
    }
  }

  const saveCommentDraft = (comment: string): void => {
    if (viewerState.kind !== "reviewing") return
    const vibe = viewerState.campaign.vibes[currentIndex]
    if (!vibe) return
    setCommentDrafts(drafts => ({ ...drafts, [vibe.id]: comment }))
  }

  const goPrevious = (): void => {
    if (isSaving) return
    setSaveError(undefined)
    setCurrentIndex(index => Math.max(0, index - 1))
  }

  const editResponses = (): void => {
    if (viewerState.kind !== "complete") return

    const { campaign, session } = viewerState
    const firstIncompleteIndex = campaign.vibes.findIndex(vibe => session.feedback[vibe.id] === undefined)
    setCurrentIndex(firstIncompleteIndex === -1 ? campaign.vibes.length - 1 : firstIncompleteIndex)
    setSaveError(undefined)
    setViewerState({ campaign, kind: "reviewing", session })
  }

  const goNext = async (): Promise<void> => {
    if (viewerState.kind !== "reviewing" || isSaving) return

    const { campaign, session } = viewerState
    const vibe = campaign.vibes[currentIndex]
    if (!vibe) return

    let updatedSession = session
    if (campaign.votingSystem === "comment") {
      const comment = commentDrafts[vibe.id] ?? commentFrom(session.feedback[vibe.id])
      if (comment !== commentFrom(session.feedback[vibe.id])) {
        const savedSession = await saveFeedback({ comment, kind: "comment" })
        if (!savedSession) return
        updatedSession = savedSession
      }
    }

    await finishOrAdvance(campaign, updatedSession)
  }
  const announcement = getAnnouncement(viewerState, isSaving, saveError)
  const isReviewing = viewerState.kind === "reviewing"
  const title =
    viewerState.kind === "reviewing" || viewerState.kind === "complete" ? viewerState.campaign.title : "Vibe Check"
  const activeVibe = isReviewing ? viewerState.campaign.vibes[currentIndex] : undefined
  const activeFeedback = activeVibe && isReviewing ? viewerState.session.feedback[activeVibe.id] : undefined
  const progress = getProgress(viewerState, currentIndex)
  const votingSystem =
    viewerState.kind === "reviewing" || viewerState.kind === "complete" ? viewerState.campaign.votingSystem : undefined

  return (
    <main className="review-shell" data-preview-width={previewMode}>
      <p
        aria-live={saveError || viewerState.kind === "error" ? "assertive" : "polite"}
        className="sr-only"
        role="status"
      >
        {announcement}
      </p>
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <h1 className="min-w-0 truncate text-base font-bold leading-tight text-ink sm:text-xl">{title}</h1>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
          {isReviewing && activeVibe && (
            <div className="header-queue">
              <p className="shrink-0 text-sm text-muted">{progress}</p>
              <button
                aria-label="Previous Vibe"
                className="queue-button"
                disabled={isSaving || currentIndex === 0}
                onClick={goPrevious}
                type="button"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                aria-label={currentIndex === viewerState.campaign.vibes.length - 1 ? "Finish review" : "Next Vibe"}
                className="queue-button"
                disabled={isSaving}
                onClick={() => void goNext()}
                type="button"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          )}
          {isReviewing && activeVibe?.kind === "html" && (
            <PreviewModePicker onChange={changePreviewMode} value={previewMode} />
          )}
          {votingSystem && (
            <button
              aria-label="How this review works"
              className="help-button"
              onClick={() => setIsHelpOpen(true)}
              type="button"
            >
              <CircleHelp aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <section className="min-h-0 min-w-0 overflow-hidden" aria-label="Campaign review">
        {viewerState.kind === "loading" && <LoadingState />}
        {viewerState.kind === "error" && <ErrorState error={viewerState.error} onRetry={retry} />}
        {isReviewing && activeVibe && <ReviewState isSaving={isSaving} previewMode={previewMode} vibe={activeVibe} />}
        {(viewerState.kind === "complete" || viewerState.kind === "thank-you") && (
          <ThankYouState onEdit={viewerState.kind === "complete" ? editResponses : undefined} />
        )}
      </section>

      {isReviewing && activeVibe && (
        <footer className="review-footer">
          <div className="feedback-navigation">
            <button
              aria-label="Previous Vibe"
              className="queue-button"
              disabled={isSaving || currentIndex === 0}
              onClick={goPrevious}
              type="button"
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <VotingControls
              comment={commentDrafts[activeVibe.id] ?? commentFrom(activeFeedback)}
              feedback={activeFeedback}
              isSaving={isSaving}
              onCommentChange={saveCommentDraft}
              onFeedback={feedback => void saveFeedback(feedback, feedback.kind !== "comment")}
              votingSystem={viewerState.campaign.votingSystem}
            />
            <button
              aria-label={currentIndex === viewerState.campaign.vibes.length - 1 ? "Finish review" : "Next Vibe"}
              className="queue-button"
              disabled={isSaving}
              onClick={() => void goNext()}
              type="button"
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </footer>
      )}

      {saveError && isReviewing && (
        <div className="review-toast" role="alert">
          {saveError}
        </div>
      )}
      {votingSystem && (
        <VotingHelpDialog isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} votingSystem={votingSystem} />
      )}
    </main>
  )
}

function LoadingState(): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center bg-canvas p-4" role="status">
      <p className="text-sm text-muted">Loading campaign…</p>
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }): React.JSX.Element {
  return (
    <div className="h-full overflow-auto bg-canvas p-4 sm:p-6">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-bold text-ink">Unable to load Vibe Check</h2>
        <p className="mt-2 leading-relaxed text-error">{error}</p>
        <button className="retry-button mt-4" onClick={onRetry} type="button">
          Try again
        </button>
      </div>
    </div>
  )
}

function ReviewState({
  isSaving,
  previewMode,
  vibe,
}: {
  isSaving: boolean
  previewMode: PreviewMode
  vibe: Campaign["vibes"][number]
}): React.JSX.Element {
  return (
    <div className="h-full bg-preview-chrome">
      <VibePreview mode={vibe.kind === "markdown" ? "full" : previewMode} vibe={vibe} />
      <span className="sr-only">{isSaving ? "Saving your feedback" : `Reviewing ${vibe.label}`}</span>
    </div>
  )
}

function ThankYouState({ onEdit }: { onEdit?: () => void }): React.JSX.Element {
  return (
    <div className="grid h-full place-items-center overflow-auto bg-canvas p-4 sm:p-6">
      <div className="w-full max-w-2xl text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-love-surface text-on-love">
          <Heart aria-hidden className="size-7" fill="currentColor" />
        </div>
        <p className="mt-6 text-sm font-bold tracking-wide text-muted uppercase">Vibes Checked!</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Thanks for sharing your perspective.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          A thoughtful reaction helps people make better things. <br />
          You have done your part, now go make something lovely!
        </p>

        <section className="mt-8 rounded-2xl border border-border bg-surface p-6 text-left shadow-sm sm:p-8">
          <p className="text-sm font-bold tracking-wide text-muted uppercase">Keep the good vibes moving</p>
          <h3 className="mt-2 text-xl font-bold text-ink">Create your own Vibe Check</h3>
          <p className="mt-2 leading-relaxed text-muted">
            Install the skill, point it at a folder of ideas, and invite your people to react together.
          </p>
          <code className="mt-5 block overflow-x-auto rounded-control bg-canvas px-4 py-3 text-sm font-semibold text-ink">
            npx skills add we-are-singular/vibe-check
          </code>
          <a
            className="mt-5 inline-flex items-center gap-1 font-bold text-focus hover:underline"
            href="https://github.com/we-are-singular/vibe-check"
            rel="noreferrer"
            target="_blank"
          >
            Star Vibe Check on GitHub
            <ArrowUpRight aria-hidden className="size-4" />
          </a>
          {onEdit && (
            <button className="retry-button mt-5" onClick={onEdit} type="button">
              Review my responses
            </button>
          )}
        </section>
      </div>
    </div>
  )
}

function getAnnouncement(viewerState: ViewerState, isSaving: boolean, saveError: string | undefined): string {
  if (saveError) return saveError
  if (viewerState.kind === "error") return `Unable to load Vibe Check. ${viewerState.error}`
  if (viewerState.kind === "complete" || viewerState.kind === "thank-you") return "Thanks for sharing your perspective."
  if (isSaving) return "Saving your feedback."
  return ""
}

function getProgress(viewerState: ViewerState, currentIndex: number): string {
  if (viewerState.kind === "loading") return "Loading campaign…"
  if (viewerState.kind === "error") return "Review unavailable"
  if (viewerState.kind === "complete" || viewerState.kind === "thank-you") return "Thank you"
  return `Vibe ${currentIndex + 1} of ${viewerState.campaign.vibes.length}`
}

function commentFrom(feedback: Feedback | undefined): string {
  return feedback?.kind === "comment" ? feedback.comment : ""
}

function getCommentDrafts(session: ReviewSession): Record<string, string> {
  return Object.fromEntries(
    Object.entries(session.feedback).flatMap(([vibeId, feedback]) =>
      feedback.kind === "comment" ? [[vibeId, feedback.comment]] : []
    )
  )
}
