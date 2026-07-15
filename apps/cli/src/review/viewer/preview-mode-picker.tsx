import { Maximize2, Monitor, Smartphone, Tablet } from "lucide-react"

const PREVIEW_MODES = ["full", "wide", "tablet", "phone"] as const

/** Supported iframe viewport presets for reviewing a candidate. */
export type PreviewMode = (typeof PREVIEW_MODES)[number]

type PreviewModePickerProps = {
  onChange: (mode: PreviewMode) => void
  value: PreviewMode
}

const modeDetails = {
  full: { Icon: Maximize2, label: "Full", title: "Full available width" },
  wide: { Icon: Monitor, label: "Wide", title: "Wide desktop — 1280px" },
  tablet: { Icon: Tablet, label: "Tablet", title: "Tablet portrait — 768px" },
  phone: { Icon: Smartphone, label: "Phone", title: "Phone — 390px" },
} satisfies Record<PreviewMode, { Icon: typeof Maximize2; label: string; title: string }>

/** Narrows a stored browser preference to a supported preview preset. */
export function isPreviewMode(value: string | null): value is PreviewMode {
  return PREVIEW_MODES.includes(value as PreviewMode)
}

/** Lets a reviewer choose the width used for the candidate iframe. */
export function PreviewModePicker({ onChange, value }: PreviewModePickerProps): React.JSX.Element {
  return (
    <fieldset className="flex gap-1 rounded-control border border-border bg-canvas p-1" aria-label="Preview width">
      <legend className="sr-only">Preview width</legend>
      {PREVIEW_MODES.map(mode => {
        const { Icon, label, title } = modeDetails[mode]
        const id = `preview-width-${mode}`

        return (
          <div key={mode}>
            <input
              aria-label={title}
              checked={value === mode}
              className="peer sr-only"
              id={id}
              name="preview-width"
              onChange={() => onChange(mode)}
              type="radio"
              value={mode}
            />
            <label
              className="flex min-h-9 cursor-pointer items-center justify-center gap-1 rounded-subtle px-2 text-xs font-bold text-muted transition-colors duration-150 ease-ui hover:bg-border-subtle hover:text-ink peer-checked:bg-ink peer-checked:text-surface peer-focus-visible:outline-2 peer-focus-visible:outline-focus peer-focus-visible:outline-offset-2"
              htmlFor={id}
              title={title}
            >
              <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
              <span className="hidden sm:inline">{label}</span>
            </label>
          </div>
        )
      })}
    </fieldset>
  )
}
