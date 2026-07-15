/** Narrows unknown JSON values to non-array object records at transport boundaries. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Extracts the user-safe message carried by thrown errors and JSON error responses. */
export function getErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message
  if (isRecord(value) && typeof value.error === "string") return value.error
  if (isRecord(value) && typeof value.message === "string") return value.message
  return "An unexpected error occurred."
}
