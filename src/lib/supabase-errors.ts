export function isSupabaseSchemaUnavailable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const code = "code" in error ? error.code : undefined
  const message = "message" in error && typeof error.message === "string" ? error.message : ""
  return code === "PGRST202" ||
    code === "PGRST205" ||
    code === "42P01" ||
    code === "42883" ||
    /schema cache|relation .* does not exist|function .* does not exist/i.test(message)
}
