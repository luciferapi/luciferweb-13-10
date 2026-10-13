import Link from "next/link"
import { ArrowLeft, Clock3, History } from "lucide-react"

export function OwnerProjectRequestsHistoryPage() {
  return (
    <main className="owner-history-page">
      <header className="owner-heading owner-history-hero">
        <div>
          <p className="owner-kicker">OWNER WORKSPACE / PROJECT REQUESTS / HISTORY</p>
          <h1>Roadmap update history</h1>
          <p>Review past roadmap changes for paid project requests.</p>
        </div>
        <Link href="/owner/project-requests" className="owner-history-back">
          <ArrowLeft aria-hidden="true" size={16} />
          Back to requests
        </Link>
      </header>

      <section className="owner-history-card" aria-labelledby="owner-history-title">
        <div className="owner-history-icon"><History aria-hidden="true" size={22} /></div>
        <div className="owner-history-copy">
          <span className="owner-history-label"><Clock3 aria-hidden="true" size={14} /> HISTORY NOT CONNECTED</span>
          <h2 id="owner-history-title">Roadmap history is not available yet</h2>
          <p>
            Project requests are stored on the server, but owner decisions, responses, and roadmap images do not yet have
            persistent database fields. No sample history is shown; roadmap updates will be available once that workflow is implemented.
          </p>
          <Link href="/owner/project-requests" className="owner-history-action">
            View paid project requests
            <ArrowLeft aria-hidden="true" size={15} />
          </Link>
        </div>
      </section>
    </main>
  )
}
