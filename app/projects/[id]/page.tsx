import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ExternalLink, Github } from "lucide-react"
import { Footer } from "@/components/footer"
import { ProjectCheckout } from "@/components/project-checkout"
import { requireSignedInUser } from "@/lib/auth-session"
import { readProjects } from "@/lib/project-store"
import { formatPriceInr, parsePriceToPaise } from "@/lib/project-pricing"
import { hasProjectSourceBundle } from "@/lib/source-bundles"
import { getProjectDemoVideo } from "@/lib/project-demo-videos"

export const dynamic = "force-dynamic"

export default async function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  await requireSignedInUser(`/projects/${resolvedParams.id}`)
  const { id } = resolvedParams
  const project = (await readProjects()).find((entry) => entry.code === id && entry.isPublished)
  if (!project) notFound()
  const amountPaise = parsePriceToPaise(project.price)
  const sourceBundleAvailable = await hasProjectSourceBundle(project.code)
  const demoVideoAvailable = project.demoVideo
    ? /^https?:\/\//i.test(project.demoVideo) || Boolean(await getProjectDemoVideo(project.demoVideo))
    : false
  const demoVideoSource = project.demoVideo && /^https?:\/\//i.test(project.demoVideo)
    ? project.demoVideo
    : project.demoVideo ? `/api/project-demo/${encodeURIComponent(project.demoVideo)}` : ""

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-36">
        <Link href="/projects" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="size-4" /> All projects
        </Link>
        <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="overflow-hidden rounded-lg border border-border bg-muted">
            <img
              src={project.imageUrl || "/images/luciferai-brand-logo.jpg"}
              alt={`${project.title} project preview`}
              className="aspect-[16/10] w-full object-cover"
            />
          </div>
          <div className="pt-1">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300">{project.category} / Project details</p>
            <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.04em] md:text-5xl">{project.title}</h1>
            <p className="mt-5 text-base leading-7 text-muted-foreground">{project.description}</p>
            <p className="mt-4 font-mono text-xs text-muted-foreground">Project ID: <span className="text-foreground">#{project.projectNumber}</span></p>
            <p className="mt-4 font-mono text-xs text-muted-foreground">Project code: <span className="select-all text-foreground">{project.code}</span></p>

            <div className="mt-8 border-t border-border pt-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Technologies</h2>
              {project.technologies.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {project.technologies.map((technology) => (
                    <li key={technology} className="rounded-md border border-border px-2.5 py-1 text-sm">{technology}</li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-sm text-muted-foreground">Not listed</p>}
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Role / contribution</h2>
              <p className="mt-2 text-sm leading-6">{project.role || "Not specified"}</p>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border py-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Price</h2>
              <p className="text-sm font-semibold">{amountPaise ? formatPriceInr(amountPaise) : project.price || "Not listed"}</p>
            </div>

            {amountPaise && sourceBundleAvailable ? (
              <ProjectCheckout
                projectId={project.code}
                title={project.title}
                amountPaise={amountPaise}
                purchaseLabel={`Source Code · ${formatPriceInr(amountPaise)}`}
              />
            ) : null}
            {amountPaise && !sourceBundleAvailable ? (
              <p className="mt-5 text-sm text-muted-foreground" role="status">Source code is being prepared and cannot be purchased yet.</p>
            ) : null}

            <div className="flex flex-wrap gap-3 border-t border-border pt-5">
              {project.liveDemoUrl ? (
                <a href={project.liveDemoUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">
                  Live Demo <ExternalLink aria-hidden="true" className="size-4" />
                </a>
              ) : (
                <button type="button" disabled className="inline-flex h-11 items-center gap-2 rounded-lg bg-cyan-300/40 px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed dark:text-slate-300">
                  Live Demo <ExternalLink aria-hidden="true" className="size-4" />
                </button>
              )}
              {project.sourceCodeUrl && !amountPaise ? (
                <a href={project.sourceCodeUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold transition hover:border-cyan-400">
                  <Github aria-hidden="true" className="size-4" /> Source Code
                </a>
              ) : !amountPaise ? (
                <button type="button" disabled className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground disabled:cursor-not-allowed">
                  <Github aria-hidden="true" className="size-4" /> Source Code
                </button>
              ) : null}
            </div>
          </div>
        </div>
        {demoVideoAvailable && project.demoVideo ? (
          <section className="mt-12 max-w-5xl" aria-labelledby="project-demo-heading">
            <h2 id="project-demo-heading" className="mb-4 text-xl font-bold">Project demo</h2>
            <video
              controls
              playsInline
              preload="metadata"
              className="max-h-[75vh] w-full rounded-lg border border-border bg-black"
              aria-label={`${project.title} demo video`}
            >
              <source src={demoVideoSource} />
              Your browser does not support embedded video.
            </video>
          </section>
        ) : null}
      </section>
      <Footer />
    </main>
  )
}