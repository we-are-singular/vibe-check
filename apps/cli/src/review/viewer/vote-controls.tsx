import type { Vote } from "../../types.js"

type VoteControlsProps = {
  isSaving: boolean
  onVote: (vote: Vote) => void
}

/** Presents the three mutually exclusive verdict actions for the active Vibe. */
export function VoteControls({ isSaving, onVote }: VoteControlsProps): React.JSX.Element {
  return (
    <div aria-busy={isSaving} className="vote-controls" role="group" aria-label="Review actions">
      <button
        aria-label="Pass this Vibe"
        className="vote-button border-border bg-pass-surface text-pass-ink enabled:hover:bg-pass-hover"
        disabled={isSaving}
        onClick={() => onVote("pass")}
        type="button"
      >
        Pass
      </button>
      <button
        aria-label="Keep this Vibe"
        className="vote-button border-keep-surface bg-keep-surface text-keep-ink enabled:hover:border-keep-hover enabled:hover:bg-keep-hover"
        disabled={isSaving}
        onClick={() => onVote("keep")}
        type="button"
      >
        Keep
      </button>
      <button
        aria-label="I love it"
        className="vote-button border-love-surface bg-love-surface text-on-love shadow-love enabled:hover:border-love-hover enabled:hover:bg-love-hover enabled:hover:shadow-love-hover enabled:active:border-love-active enabled:active:bg-love-active"
        disabled={isSaving}
        onClick={() => onVote("love")}
        type="button"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ❤️
        </span>
        <span>I love it</span>
      </button>
    </div>
  )
}
