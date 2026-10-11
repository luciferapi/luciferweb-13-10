import { Footer } from "@/components/layout/footer"
import Link from "next/link"
import { ProjectSearch } from "@/features/projects/components/project-search"
import { LiveBannerTicker } from "@/features/marketing/components/live-banner-ticker"
import { requireSignedInUser } from "@/features/auth/server/auth-session"
import { readProjects } from "@/features/projects/server/project-store"

export const dynamic = "force-dynamic"

export default async function ProjectsPage() {
  await requireSignedInUser("/projects")
  const projects = (await readProjects()).filter((project) => project.isPublished && project.category !== "API")

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto min-h-[70vh] max-w-6xl px-5 pb-24 pt-32 sm:px-8">
        <LiveBannerTicker placement="inline" />
        <header className="grid gap-6 border-b border-border pb-8 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300">Project library</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Projects</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Browse published work, review the details, and find a project that fits what you want to build.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{projects.length}</span>{" "}
              {projects.length === 1 ? "project" : "projects"} available
            </p>
            <Link
              href="/contact#project-request"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-center text-sm font-bold text-slate-950 transition hover:-translate-y-px hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
            >
              Request a custom project · ₹1 fee
            </Link>
          </div>
        </header>
        <ProjectSearch projects={projects} />
      </section>
      <Footer />
    </main>
  )
}