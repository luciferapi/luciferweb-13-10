import { ArrowLeft, ShieldCheck, Wrench } from "lucide-react"
import Link from "next/link"
import { Footer } from "@/components/footer"

export default function WatchAdsAndTasksPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto min-h-[70vh] max-w-5xl px-6 pb-24 pt-40">
        <Link href="/pocket-money" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
          <ArrowLeft aria-hidden="true" size={16} /> Pocket Money
        </Link>
        <p className="mt-10 font-mono text-xs uppercase tracking-[0.3em] text-cyan-500 dark:text-cyan-300">{"// watch ads & tasks"}</p>
        <h1 className="mt-5 text-4xl font-black uppercase tracking-[-0.05em] md:text-6xl">Watch Ads & Tasks</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          Learn how to assess reward platforms and small online tasks before you spend time on them.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card/70 p-6">
            <Wrench aria-hidden="true" className="text-cyan-700 dark:text-cyan-200" size={22} />
            <h2 className="mt-4 text-lg font-bold">Check the terms first</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Confirm the payout threshold, time required, eligible regions, and how rewards are actually redeemed before starting.</p>
          </article>
          <article className="rounded-2xl border border-border bg-card/70 p-6">
            <ShieldCheck aria-hidden="true" className="text-cyan-700 dark:text-cyan-200" size={22} />
            <h2 className="mt-4 text-lg font-bold">Protect your accounts</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Avoid sites that request upfront fees, passwords, one-time codes, or unnecessary identity and payment information.</p>
          </article>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">No third-party earning platform is endorsed or guaranteed here. Research independently before participating.</p>
      </section>
      <Footer />
    </main>
  )
}
