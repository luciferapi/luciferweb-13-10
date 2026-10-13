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
      <section className="mx-auto min-h-[70vh] max-w-6xl px-5 pb-24 pt-28 sm:px-8">
        <LiveBannerTicker placement="inline" />
        <header className="relative isolate overflow-hidden rounded-[2rem] border border-border bg-[radial-gradient(circle_at_85%_15%,color-mix(in_oklch,var(--catalog-glow)_18%,transparent),transparent_38%),linear-gradient(135deg,color-mix(in_oklch,var(--card)_94%,var(--catalog-glow)),var(--card))] px-6 py-8 shadow-[0_24px_80px_color-mix(in_oklch,var(--catalog-glow)_10%,transparent)] sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full border border-[color-mix(in_oklch,var(--catalog-glow)_30%,transparent)] opacity-60" aria-hidden="true" />
          <div className="relative max-w-2xl">
            <div className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">
              <span className="size-2 rounded-full bg-[var(--catalog-glow)] shadow-[0_0_18px_var(--catalog-glow)]" />
              Project library
            </div>
            <h1 className="max-w-xl text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-6xl">Build from a stronger starting point.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Production-ready websites, APIs, and automations with the source code to take your next idea further.
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
