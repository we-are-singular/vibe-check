import type { ResultRow } from "../../types.js"

type ResultsTableProps = {
  results: readonly ResultRow[]
}

/** Displays aggregate Campaign results in their server-provided rank order. */
export function ResultsTable({ results }: ResultsTableProps): React.JSX.Element {
  return (
    <table className="w-full border-collapse bg-surface text-left">
      <caption className="sr-only">Campaign results ranked by Loves, then Keeps</caption>
      <thead>
        <tr className="border-b border-border-subtle text-sm text-muted">
          <th className="p-3 font-semibold" scope="col">
            Vibe
          </th>
          <th className="p-3 text-right font-semibold" scope="col">
            Loves
          </th>
          <th className="p-3 text-right font-semibold" scope="col">
            Keeps
          </th>
        </tr>
      </thead>
      <tbody>
        {results.map(result => (
          <tr className="border-b border-border-subtle last:border-b-0" key={result.id}>
            <th className="p-3 font-semibold text-ink" scope="row">
              {result.label}
            </th>
            <td
              aria-label={`${result.loveCount} ${result.loveCount === 1 ? "love" : "loves"}`}
              className="p-3 text-right"
            >
              {result.loveCount === 0 ? (
                <span aria-hidden="true">—</span>
              ) : (
                Array.from({ length: result.loveCount }, (_, index) => (
                  <span aria-hidden="true" key={index}>
                    ❤️
                  </span>
                ))
              )}
            </td>
            <td
              aria-label={`${result.keepCount} ${result.keepCount === 1 ? "keep" : "keeps"}`}
              className="p-3 text-right"
            >
              {result.keepCount}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
