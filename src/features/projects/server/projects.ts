export const PROJECT_CATEGORIES = ["API", "Web", "UI/UX", "Automation"] as const
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number]

export type Project = {
  projectNumber: number
  id: string
  code: string
  title: string
  description: string
  category: ProjectCategory
  imageUrl: string
  demoVideo?: string
  technologies: string[]
  role: string
  liveDemoUrl: string
  sourceCodeUrl: string
  price: string
  isPublished: boolean
  updatedAt: string
}

export function slugifyProjectTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "") || "project"
}

export function findAvailableProjectCode(title: string, existingCodes: Iterable<string>, uniqueId?: string): string {
  const codes = new Set(existingCodes)
  const base = slugifyProjectTitle(title)
  if (uniqueId) {
    const token = uniqueId.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 32)
    const uniqueBase = `${base.slice(0, 80).replace(/-+$/g, "")}-${token}`
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
