import type { Feedback, Vote, VotingSystem } from "../../types.js"

type VotingControlsProps = {
  comment: string
  feedback: Feedback | undefined
  isSaving: boolean
  onCommentChange: (comment: string) => void
  onFeedback: (feedback: Feedback) => void
  votingSystem: VotingSystem
}

/** Renders the active Campaign's feedback control while keeping selected feedback visible. */
export function VotingControls({
  comment,
  feedback,
  isSaving,
  onCommentChange,
  onFeedback,
  votingSystem,
}: VotingControlsProps): React.JSX.Element {
  if (votingSystem === "stars") {
    const selectedRating = feedback?.kind === "stars" ? feedback.rating : undefined
    return (
      <div aria-busy={isSaving} aria-label="Star rating" className="star-controls" role="group">
        {([1, 2, 3, 4, 5] as const).map(rating => (
          <button
            aria-label={`Rate this Vibe ${rating} ${rating === 1 ? "star" : "stars"}`}
            aria-pressed={selectedRating === rating}
            className="star-button"
            data-lit={(selectedRating !== undefined && rating <= selectedRating) || undefined}
            data-selected={selectedRating === rating || undefined}
            disabled={isSaving}
            key={rating}
            onClick={() => onFeedback({ kind: "stars", rating })}
            type="button"
          >
            <span aria-hidden="true">★</span>
            <span className="sr-only">{rating}</span>
          </button>
        ))}
      </div>
    )
  }

  if (votingSystem === "comment") {
    return (
      <label className="comment-control">
        <span className="sr-only">Feedback for this Vibe</span>
        <textarea
          className="comment-input"
          disabled={isSaving}
          onChange={event => onCommentChange(event.target.value)}
          placeholder="Leave feedback (optional)"
          value={comment}
        />
      </label>
    )
  }

  const selectedVote = feedback?.kind === "tinder" ? feedback.vote : undefined
  return (
    <div aria-busy={isSaving} aria-label="Verdict" className="voting-controls" role="group">
      <VerdictButton isSaving={isSaving} onFeedback={onFeedback} selectedVote={selectedVote} vote="pass">
        Pass
      </VerdictButton>
      <VerdictButton isSaving={isSaving} onFeedback={onFeedback} selectedVote={selectedVote} vote="keep">
        Keep
      </VerdictButton>
      <VerdictButton isSaving={isSaving} onFeedback={onFeedback} selectedVote={selectedVote} vote="love">
        <span aria-hidden="true" className="text-xl leading-none">
          ❤️
        </span>
      </VerdictButton>
    </div>
  )
}

function VerdictButton({
  children,
  isSaving,
  onFeedback,
  selectedVote,
  vote,
}: {
  children: React.ReactNode
  isSaving: boolean
  onFeedback: (feedback: Feedback) => void
  selectedVote: Vote | undefined
  vote: Vote
}): React.JSX.Element {
  const classes = {
    pass: "border-border bg-pass-surface text-pass-ink enabled:hover:bg-pass-hover",
    keep: "border-keep-surface bg-keep-surface text-keep-ink enabled:hover:border-keep-hover enabled:hover:bg-keep-hover",
    love: "border-love-surface bg-love-surface text-on-love shadow-love enabled:hover:border-love-hover enabled:hover:bg-love-hover enabled:hover:shadow-love-hover enabled:active:border-love-active enabled:active:bg-love-active",
  } as const

  const labels = {
    pass: "Pass this Vibe",
    keep: "Keep this Vibe",
    love: "I love it",
  } as const

  return (
    <button
      aria-label={labels[vote]}
      aria-pressed={selectedVote === vote}
      className={`vote-button ${vote === "love" ? "vote-button-love" : ""} ${classes[vote]}`}
      data-selected={selectedVote === vote || undefined}
      disabled={isSaving}
      onClick={() => onFeedback({ kind: "tinder", vote })}
      type="button"
    >
      {children}
    </button>
  )
}
