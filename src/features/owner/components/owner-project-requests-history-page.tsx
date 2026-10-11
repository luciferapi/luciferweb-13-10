import Link from "next/link"

export function OwnerProjectRequestsHistoryPage() {
  return (
    <div className="owner-projects space-y-8">
      <section className="rounded-xl border border-border bg-card/30 p-4 sm:p-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">Owner workspace</p>
        <h2 className="mt-2 text-xl font-bold">Roadmap updates are not connected</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Project requests are stored on the server, but owner decisions, responses, and roadmap images do not yet have persistent database fields. No sample request history is shown, and roadmap changes are unavailable until that workflow is implemented.
        </p>
        <Link
          href="/owner/project-requests"
          className="mt-5 inline-flex min-h-10 items-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-500/15 dark:text-cyan-200"
        >
          View paid project requests
        </Link>
      </section>
    </div>
  )
}
