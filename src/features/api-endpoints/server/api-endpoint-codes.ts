export function findAvailableApiEndpointCode(name: string, existingCodes: Iterable<string>): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "") || "api"
  const codes = new Set(existingCodes)
  if (!codes.has(base)) return base

  let suffix = 2
  while (codes.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}
