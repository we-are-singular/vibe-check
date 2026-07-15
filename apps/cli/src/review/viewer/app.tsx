import { useEffect, useState } from "react"
import { PreviewModePicker, isPreviewMode, type PreviewMode } from "./preview-mode-picker.js"
import { ResultsTable } from "./results-table.js"
import { ReviewApiClient, type Campaign, type ReviewSession } from "./api.js"
import type { ResultRow, Vote } from "../../types.js"
import { getErrorMessage } from "../../utils.js"
import { VibePreview } from "./vibe-preview.js"
import { VoteControls } from "./vote-controls.js"

const defaultApi = new ReviewApiClient()

type ViewerState =
  | { kind: "loading" }
  | { error: string; kind: "error" }
  | { campaign: Campaign; kind: "reviewing"; session: ReviewSession }
  | { campaign: Campaign; kind: "results"; results: readonly ResultRow[]; session: ReviewSession }

type ViewerAppProps = {
  api?: ReviewApiClient
}

/** Owns the browser review workflow, local preferences, and verdict submission UI. */
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
  const [reloadGeneration, setReloadGeneration] = useState(0)
  const [saveError, setSaveError] = useState<string | undefined>()
  const [isSaving, setIsSaving] = useState(false)
  const [viewerState, setViewerState] = useState<ViewerState>({ kind: "loading" })

  useEffect(() => {
    let ignored = false

    const initialize = async (): Promise<void> => {
      setViewerState({ kind: "loading" })
      setSaveError(undefined)
      setIsSaving(false)

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

        if (Object.keys(session.votes).length === campaign.vibes.length) {
          const results = await api.getResults(session.sessionId)
          if (!ignored) setViewerState({ campaign, kind: "results", results, session })
          return
        }

        if (!ignored) setViewerState({ campaign, kind: "reviewing", session })
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

  const saveVote = async (vote: Vote): Promise<void> => {
    if (viewerState.kind !== "reviewing" || isSaving) return

    const vibe = viewerState.campaign.vibes.find(candidate => viewerState.session.votes[candidate.id] === undefined)
    if (!vibe) return

    const { campaign, session } = viewerState
    setIsSaving(true)
    setSaveError(undefined)

    try {
      const updatedSession = await api.recordVote({
        sessionId: session.sessionId,
        vibeId: vibe.id,
        vote,
      })

      if (Object.keys(updatedSession.votes).length === campaign.vibes.length) {
        const results = await api.getResults(updatedSession.sessionId)
        setViewerState({ campaign, kind: "results", results, session: updatedSession })
      } else {
        setViewerState({ campaign, kind: "reviewing", session: updatedSession })
      }
    } catch (error) {
      setSaveError(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const title =
    viewerState.kind === "reviewing" || viewerState.kind === "results" ? viewerState.campaign.title : "Vibe Check"
  const progress = getProgress(viewerState)
  const status = getStatus(viewerState, isSaving, saveError)

  return (
    <main className="review-shell" data-preview-width={previewMode}>
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <h1 className="min-w-0 truncate text-base font-bold leading-tight text-ink sm:text-xl">{title}</h1>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
          <p aria-live="polite" className="shrink-0 text-sm text-muted">
            {progress}
          </p>
          <PreviewModePicker onChange={changePreviewMode} value={previewMode} />
        </div>
      </header>

      <section className="min-h-0 min-w-0 overflow-hidden" aria-label="Campaign review">
        {viewerState.kind === "loading" && <LoadingState />}
        {viewerState.kind === "error" && <ErrorState error={viewerState.error} />}
        {viewerState.kind === "reviewing" && (
          <ReviewState
            campaign={viewerState.campaign}
            isSaving={isSaving}
            previewMode={previewMode}
            session={viewerState.session}
          />
        )}
        {viewerState.kind === "results" && <ResultsState results={viewerState.results} />}
      </section>

      <footer className="review-footer">
        <p
          aria-live="polite"
          className={saveError || viewerState.kind === "error" ? "text-error" : "text-muted"}
          role={saveError || viewerState.kind === "error" ? "alert" : undefined}
        >
          {status}
        </p>
        {viewerState.kind === "reviewing" && <VoteControls isSaving={isSaving} onVote={saveVote} />}
        {viewerState.kind === "error" && (
          <button
            className="vote-button border-border bg-pass-surface text-pass-ink enabled:hover:bg-pass-hover"
            onClick={retry}
            type="button"
          >
            Try again
          </button>
        )}
      </footer>
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

function ErrorState({ error }: { error: string }): React.JSX.Element {
  return (
    <div className="h-full overflow-auto bg-canvas p-4 sm:p-6">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-bold text-ink">Unable to load Vibe Check</h2>
        <p className="mt-2 leading-relaxed text-error">{error}</p>
      </div>
    </div>
  )
}

function ReviewState({
  campaign,
  isSaving,
  previewMode,
  session,
}: {
  campaign: Campaign
  isSaving: boolean
  previewMode: PreviewMode
  session: ReviewSession
}): React.JSX.Element {
  const vibe = campaign.vibes.find(candidate => session.votes[candidate.id] === undefined)
  if (!vibe) return <LoadingState />

  return (
    <div className="h-full bg-preview-chrome">
      <VibePreview mode={previewMode} vibe={vibe} />
      <span className="sr-only">{isSaving ? "Saving your choice" : `Reviewing ${vibe.label}`}</span>
    </div>
  )
}

function ResultsState({ results }: { results: readonly ResultRow[] }): React.JSX.Element {
  return (
    <div className="h-full overflow-auto bg-canvas p-4 sm:p-6">
      <div className="max-w-5xl">
        <h2 className="text-2xl font-bold text-ink">Results</h2>
        <p className="mt-1 mb-5 max-w-2xl leading-relaxed text-muted">
          Every Vibe is reviewed. Ranked by what the group loved most.
        </p>
        <ResultsTable results={results} />
      </div>
    </div>
  )
}

function getProgress(viewerState: ViewerState): string {
  if (viewerState.kind === "loading") return "Loading campaign…"
  if (viewerState.kind === "error") return "Review unavailable"
  if (viewerState.kind === "results") return "Results"

  const position = viewerState.campaign.vibes.findIndex(vibe => viewerState.session.votes[vibe.id] === undefined) + 1
  return `Vibe ${position} of ${viewerState.campaign.vibes.length}`
}

function getStatus(viewerState: ViewerState, isSaving: boolean, saveError: string | undefined): string {
  if (viewerState.kind === "loading") return "Loading campaign…"
  if (viewerState.kind === "error") return "Unable to load the campaign. Try again."
  if (saveError) return saveError
  if (viewerState.kind === "results") return "Review complete — ranked by Loves, then Keeps."
  return isSaving ? "Saving your choice…" : "Make your call: Pass, Keep, or I love it."
}
