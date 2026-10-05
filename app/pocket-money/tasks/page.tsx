import { ArrowLeft, CheckCircle2, PiggyBank } from "lucide-react"
import Link from "next/link"
import { Footer } from "@/components/footer"

export default function TasksPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto min-h-[70vh] max-w-5xl px-6 pb-24 pt-40">
        <Link href="/pocket-money" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
          <ArrowLeft aria-hidden="true" size={16} /> Pocket Money
        </Link>
        <p className="mt-10 font-mono text-xs uppercase tracking-[0.3em] text-cyan-500 dark:text-cyan-300">{"// small, clear commitments"}</p>
        <h1 className="mt-5 flex items-center gap-3 text-4xl font-black uppercase tracking-[-0.05em] md:text-6xl">
          <PiggyBank aria-hidden="true" className="size-8 text-cyan-700 dark:text-cyan-200 md:size-10" />
          Tasks
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          Find manageable tasks that match your skills, with expectations and payment terms agreed in advance.
        </p>
        <div className="mt-10 rounded-2xl border border-border bg-card/70 p-6">
          <h2 className="text-lg font-bold">Before you start</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            <li className="flex gap-3"><CheckCircle2 aria-hidden="true" className="mt-1 size-4 shrink-0 text-cyan-700 dark:text-cyan-200" />Confirm the task, deadline, and payment terms in writing.</li>
            <li className="flex gap-3"><CheckCircle2 aria-hidden="true" className="mt-1 size-4 shrink-0 text-cyan-700 dark:text-cyan-200" />Check who is requesting the work and avoid paying to access a task.</li>
            <li className="flex gap-3"><CheckCircle2 aria-hidden="true" className="mt-1 size-4 shrink-0 text-cyan-700 dark:text-cyan-200" />Share only the information needed to complete the agreed work.</li>
          </ul>
        </div>
      </section>
      <Footer />
    </main>
  )
}
