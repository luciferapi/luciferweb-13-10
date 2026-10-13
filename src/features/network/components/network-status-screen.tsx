"use client"

import Link from "next/link"

export type NetworkStatus = "offline" | "slow"

const content: Record<
  NetworkStatus,
  { label: string; title: string; description: string; action: string }
> = {
  offline: {
    label: "Connection lost",
    title: "You're offline.",
    description:
      "We can't reach the site right now. Check your Wi-Fi or mobile data, then try again.",
    action: "Try again",
  },
  slow: {
    label: "Slow connection",
    title: "This is taking a little longer.",
    description:
      "Your connection is responding slowly. You can wait, or try again when the signal improves.",
    action: "Reload page",
  },
}

export function NetworkStatusScreen({ status }: { status: NetworkStatus }) {
  const page = content[status]

  return (
    <main
      className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-12 text-foreground"
      aria-live={status === "offline" ? "assertive" : undefined}
    >
      <div className="grid w-full max-w-5xl items-center gap-12 md:grid-cols-[1fr_0.8fr] md:gap-16">
        <section className="max-w-xl">
          <p className="text-sm font-semibold tracking-wide text-lime">{page.label}</p>
          <h1 className="mt-5 text-5xl font-bold leading-[1.05] tracking-[-0.06em] sm:text-6xl">
            {page.title}
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
            {page.description}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-lime px-6 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime"
            >
              {page.action}
            </button>
            {status === "slow" ? (
              <Link
                href="/"
                className="inline-flex min-h-12 items-center rounded-full border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime"
              >
                Go to home
              </Link>
            ) : null}
          </div>

          {status === "slow" ? (
            <p className="mt-10 max-w-lg border-t border-border pt-5 text-sm leading-6 text-muted-foreground">
              If other pages are slow too, try moving closer to your router, switching networks,
              or pausing large downloads.
            </p>
          ) : (
            <p className="mt-10 border-t border-border pt-5 text-sm leading-6 text-muted-foreground">
              This page will update when your connection returns.
            </p>
          )}
        </section>

        <div aria-hidden="true" className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-border/70" />
          <div className="absolute inset-[12%] rounded-full border border-border/70" />
          <div className="absolute inset-[24%] rounded-full border border-border/70" />
          <div className="flex size-24 items-center justify-center rounded-full bg-muted text-2xl font-semibold tracking-tight text-lime">
            {status === "offline" ? "OFF" : "…"}
          </div>
          <span className="absolute left-[18%] top-[31%] size-2 rounded-full bg-lime" />
          <span className="absolute bottom-[23%] right-[22%] size-2 rounded-full bg-muted-foreground/60" />
          <span className="absolute right-[18%] top-[24%] h-px w-12 rotate-45 bg-border" />
        </div>
      </div>
    </main>
  )
}
