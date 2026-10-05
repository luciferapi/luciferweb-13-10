import { Footer } from "@/components/footer"
import { ProjectSearch } from "@/components/project-search"
import { requireSignedInUser } from "@/lib/auth-session"
import { readProjects } from "@/lib/project-store"

export const dynamic = "force-dynamic"

export default async function ProjectsPage() {
  await requireSignedInUser("/projects")
  const projects = (await readProjects()).filter((project) => project.isPublished && project.category !== "API")

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto min-h-[70vh] max-w-6xl px-6 pb-24 pt-40">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-fuchsia-400">{"// featured work"}</p>
        <h1 className="mt-6 text-5xl font-black uppercase tracking-[-0.05em] text-foreground md:text-7xl">
          PROJECTS
        </h1>
        <ProjectSearch projects={projects} />
      </section>
      <Footer />
    </main>
  )
}