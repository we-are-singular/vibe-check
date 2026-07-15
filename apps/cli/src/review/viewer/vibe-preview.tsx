import type { CampaignVibe } from "./api.js"
import type { PreviewMode } from "./preview-mode-picker.js"

type VibePreviewProps = {
  mode: PreviewMode
  vibe: CampaignVibe
}

/** Hosts one sandboxed candidate document at the selected viewport width. */
export function VibePreview({ mode, vibe }: VibePreviewProps): React.JSX.Element {
  return (
    <div className="review-preview" data-preview-width={mode}>
      <iframe
        referrerPolicy="no-referrer"
        sandbox=""
        src={`/vibes/${encodeURIComponent(vibe.id)}`}
        title={vibe.label}
      />
    </div>
  )
}
