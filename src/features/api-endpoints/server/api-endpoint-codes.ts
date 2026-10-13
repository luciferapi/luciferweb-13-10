export function findAvailableApiEndpointCode(name: string, existingCodes: Iterable<string>, uniqueId?: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "") || "api"
  const codes = new Set(existingCodes)
  if (uniqueId) {
    const token = uniqueId.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 32)
    const uniqueBase = `${base}-${token}`
    if (!codes.has(uniqueBase)) return uniqueBase
    let suffix = 2
    while (codes.has(`${uniqueBase}-${suffix}`)) suffix += 1
    return `${uniqueBase}-${suffix}`
  }
  if (!codes.has(base)) return base

  let suffix = 2
  while (codes.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}
