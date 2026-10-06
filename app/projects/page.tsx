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
      <section className="mx-auto min-h-[70vh] max-w-6xl px-5 pb-24 pt-32 sm:px-8">
        <header className="grid gap-6 border-b border-border pb-8 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300">Project library</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Projects</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Browse published work, review the details, and find a project that fits what you want to build.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{projects.length}</span>{" "}
            {projects.length === 1 ? "project" : "projects"} available
          </p>
        </header>
        <ProjectSearch projects={projects} />
      </section>
      <Footer />
    </main>
  )
}