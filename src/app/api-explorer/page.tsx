import type { Metadata } from "next"
import { ApiSection } from "@/features/marketing/components/api-section"
import { requireSignedInUser } from "@/features/auth/server/auth-session"
import { readProjects } from "@/features/projects/server/project-store"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "API Explorer | LUCIFER AI",
  description: "Explore API projects and developer tools available to signed-in LUCIFER AI users.",
  robots: { index: false, follow: false },
}

export default async function ApiExplorerPage() {
  await requireSignedInUser("/api-explorer")
  const apiProjects = (await readProjects()).filter((project) => project.isPublished && project.category === "API")

  return <main className="min-h-screen bg-background pt-20 text-foreground"><ApiSection apiProjects={apiProjects} /></main>
}
