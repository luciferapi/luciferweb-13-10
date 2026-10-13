import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Page not found | LUCIFER AI",
  description: "The page you requested could not be found. Explore LUCIFER AI or return to the homepage.",
}

const destinations = [
  { href: "/chat", label: "Chat with AI" },
  { href: "/contact", label: "Contact" },
]

export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-[70svh] items-center overflow-hidden bg-background px-4 pb-16 pt-32 text-foreground sm:px-6 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-1/2 -z-10 size-[32rem] -translate-y-1/2 rounded-full border border-lime/10 sm:-right-24"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-1/2 -z-10 size-96 -translate-y-1/2 rounded-full border border-cyan-300/10"
      />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 sm:gap-12 md:grid-cols-[0.9fr_1.1fr]">
        <div className="relative">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-lime">
            Route unavailable
          </p>
          <p
            aria-hidden="true"
            className="mt-3 select-none text-[clamp(8rem,28vw,18rem)] font-black leading-[0.78] tracking-[-0.12em] text-foreground/[0.08]"
          >
            404
          </p>
          <span className="absolute bottom-2 left-2 h-1 w-16 rounded-full bg-lime sm:bottom-4 sm:left-4 sm:w-20" />
        </div>

        <div className="max-w-xl md:py-12">
          <h1 className="text-4xl font-black tracking-[-0.07em] sm:text-5xl lg:text-6xl">
            This page isn&apos;t here.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
            The link may be outdated, or the address may have been entered incorrectly. You can
            start again or head to one of these pages.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-lime px-5 py-3 text-sm font-bold text-charcoal transition hover:bg-lime/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
            >
              Back to home
            </Link>
            <Link
              href="/projects"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:border-lime/60 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
            >
              Browse projects
            </Link>
          </div>

          <nav aria-label="Other pages" className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-5">
            {destinations.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm font-medium text-muted-foreground underline decoration-border underline-offset-4 transition hover:text-foreground hover:decoration-lime focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </main>
  )
}
