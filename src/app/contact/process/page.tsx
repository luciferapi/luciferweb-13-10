"use client"

import Link from "next/link"
import { Footer } from "@/components/layout/footer"

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
    <main className="min-h-screen overflow-hidden bg-[#09090b] text-white">
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-6 lg:px-8">
        <div className="space-y-10">
          <nav aria-label="Page sections" className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
            <Link
              href="/contact"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.02] px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
            >
              Project request
            </Link>
            <span className="inline-flex items-center rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-200">
              Process
            </span>
          </nav>

          <section className="border-t border-white/10 pt-8">
            <div className="max-w-2xl">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-200">Process</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
                How a project starts
              </h1>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {projectProcess.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-sm font-semibold text-cyan-200">
                    {index + 1}
                  </span>
                  <h2 className="mt-5 text-lg font-semibold text-white">{step.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-white/70">{step.description}</p>
                </div>
              ))}
            </div>
            <Link
              href="/contact#project-request"
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b]"
            >
              Start a project request · ₹1 fee
            </Link>
          </section>
        </div>
      </section>

      <Footer />
    </main>
  )
}
