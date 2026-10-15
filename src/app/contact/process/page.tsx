import type { Metadata } from "next"
import Link from "next/link"
import { Footer } from "@/components/layout/footer"
import { ProjectRequestHistory } from "@/features/projects/components/project-request-history"

export const metadata: Metadata = {
  title: "Project Process | LUCIFER AI",
  description: "Track the review and progress of your project requests.",
  robots: { index: false, follow: false },
}

const projectProcess = [
  {
    title: "Share the brief",
    description: "Describe what you want to build, who it is for, and the outcome you need. Your submitted request is saved to your account.",
  },
  {
    title: "Owner review",
    description: "Once the ₹1 payment is confirmed, the owner reviews your brief. An acceptance or decline and any message will appear in your request history below.",
  },
  {
    title: "Shape the plan",
    description: "If accepted, align on scope, UX direction, and the technical approach before the build begins.",
  },
  {
    title: "Build and refine",
    description: "The product is designed and developed in clear stages, with feedback loops to keep the work focused.",
  },
]

export default function ContactProcessPage() {
  return (
    <main className="home-brand-theme min-h-screen overflow-hidden bg-background text-foreground">
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-6 lg:px-8">
        <div className="space-y-10">
          <nav aria-label="Page sections" className="flex flex-wrap gap-2 border-b border-border pb-4">
            <Link
              href="/contact"
              className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-lime/40 hover:text-lime dark:bg-white/[0.02] dark:hover:border-lime/40 dark:hover:text-lime"
            >
              Project request
            </Link>
            <span className="inline-flex items-center rounded-full border border-lime/40 bg-lime/10 px-3 py-2 text-sm font-medium text-lime">
              Process &amp; updates
            </span>
          </nav>

          <section className="border-t border-border pt-8">
            <div className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-lime">Your project · Next steps</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground sm:text-4xl">
                How your project request moves forward
              </h1>
              <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">
                Keep this page bookmarked: payment status, the owner’s decision, and any message for you are shown in your private request history below.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {projectProcess.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-2xl border border-border bg-card p-5 shadow-[0_10px_40px_rgba(0,0,0,0.1)]"
                >
                  <span className="inline-flex size-9 items-center justify-center rounded-full border border-lime/30 bg-lime/10 text-sm font-semibold text-lime">
                    {index + 1}
                  </span>
                  <h2 className="mt-5 text-lg font-semibold text-foreground">{step.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </article>
              ))}
            </div>
            <Link
              href="/contact#project-request"
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl bg-lime px-5 py-3 text-sm font-bold text-charcoal transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Start a project request · ₹1 fee
            </Link>
          </section>

          <ProjectRequestHistory />
        </div>
      </section>

      <Footer />
    </main>
  )
}
