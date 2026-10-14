"use client"

import Link from "next/link"
import { Footer } from "@/components/layout/footer"
import { ProjectRequestHistory } from "@/features/projects/components/project-request-history"

const projectProcess = [
  {
    title: "Share the brief",
    description: "Tell me what you want to build, who it is for, and the outcome you care about most.",
  },
  {
    title: "Shape the plan",
    description: "We map the scope, UX direction, and technical approach before any heavy build work starts.",
  },
  {
    title: "Build and refine",
    description: "I design and develop the product in clear stages, with feedback loops to keep the work focused.",
  },
]

export default function ContactProcessPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-6 lg:px-8">
        <div className="space-y-10">
          <nav aria-label="Page sections" className="flex flex-wrap gap-2 border-b border-border pb-4">
            <Link
              href="/contact"
              className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-lime/40 hover:text-lime dark:bg-white/[0.02] dark:hover:border-lime/40 dark:hover:text-lime"
            >
              Project request
            </Link>
            <span className="inline-flex items-center rounded-full border border-lime/40 bg-lime/10 px-3 py-2 text-sm font-medium text-lime dark:border-lime/40 dark:bg-lime/10 dark:text-lime">
              Process
            </span>
          </nav>

          <section className="border-t border-border pt-8">
            <div className="max-w-2xl">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-lime dark:text-lime">Process</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground sm:text-4xl">
                How a project starts
              </h1>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {projectProcess.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-border bg-muted/40 p-5 dark:bg-white/[0.02] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-lime/30 bg-lime/10 text-sm font-semibold text-lime dark:border-lime/30 dark:bg-lime/10 dark:text-lime">
                    {index + 1}
                  </span>
                  <h2 className="mt-5 text-lg font-semibold text-foreground">{step.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
            <Link
              href="/contact#project-request"
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl bg-lime px-5 py-3 text-sm font-bold text-charcoal transition hover:bg-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
