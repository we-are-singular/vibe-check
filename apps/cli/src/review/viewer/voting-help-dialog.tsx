import { useEffect, useRef } from "react"
import type { VotingSystem } from "../../types.js"

type VotingHelpDialogProps = {
  isOpen: boolean
  onClose: () => void
  votingSystem: VotingSystem
}

/** Explains the active feedback mechanic without interrupting the review queue. */
export function VotingHelpDialog({ isOpen, onClose, votingSystem }: VotingHelpDialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      if (!dialog.open) {
        if (typeof dialog.showModal === "function") dialog.showModal()
        else dialog.setAttribute("open", "")
      }
      return
    }

    if (dialog.open) {
      if (typeof dialog.close === "function") dialog.close()
      else dialog.removeAttribute("open")
    }
  }, [isOpen])

  const guidance = getVotingGuidance(votingSystem)

  return (
    <dialog
      aria-labelledby="voting-help-title"
      className="voting-help-dialog"
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="voting-help-content">
        <h2 id="voting-help-title">How this review works</h2>
        <p>Look at one Vibe at a time. You can go back anytime, and it is fine to leave a Vibe unanswered.</p>
        <section aria-labelledby="voting-help-system">
          <h3 id="voting-help-system">{guidance.title}</h3>
          <p>{guidance.description}</p>
          <ul>
            {guidance.points.map(point => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
        <button className="help-close-button" onClick={onClose} type="button">
          Got it
        </button>
      </div>
    </dialog>
  )
}

function getVotingGuidance(votingSystem: VotingSystem): {
  description: string
  points: readonly string[]
  title: string
} {
  switch (votingSystem) {
    case "tinder":
      return {
        description: "Use the call that best matches your reaction. Choosing one takes you to the next Vibe.",
        points: [
          "Pass: not the direction for this review.",
          "Keep: worth considering.",
          "Heart: the strongest positive signal.",
        ],
        title: "Pass, Keep, or Love",
      }
    case "stars":
      return {
        description: "Choose one to five stars. More lit stars means a stronger fit.",
        points: ["One star: not a fit.", "Three stars: promising, with reservations.", "Five stars: an excellent fit."],
        title: "Star rating",
      }
    case "comment":
      return {
        description: "Write whatever would help the creator understand your reaction, then continue.",
        points: [
          "A comment is optional.",
          "Leave the box blank when you have nothing to add.",
          "Your submitted comments appear in the final summary.",
        ],
        title: "Written feedback",
      }
  }
}
