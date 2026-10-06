import { ApiSection } from "@/components/api-section"
import { requireSignedInUser } from "@/lib/auth-session"
import { readProjects } from "@/lib/project-store"

export const dynamic = "force-dynamic"

export default async function ApiExplorerPage() {
  await requireSignedInUser("/api-explorer")
  const apiProjects = (await readProjects()).filter((project) => project.isPublished && project.category === "API")

  return <main className="min-h-screen bg-background pt-20 text-foreground"><ApiSection apiProjects={apiProjects} /></main>
}
