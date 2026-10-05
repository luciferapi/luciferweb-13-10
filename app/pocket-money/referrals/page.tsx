import { ArrowLeft, Users } from "lucide-react"
import Link from "next/link"
import { Footer } from "@/components/footer"
import { ReferralDashboard } from "@/components/referral-dashboard"

export default function ReferralsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto min-h-[70vh] max-w-5xl px-6 pb-24 pt-40">
        <Link href="/pocket-money" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
          <ArrowLeft aria-hidden="true" size={16} /> Pocket Money
        </Link>
        <p className="mt-10 font-mono text-xs uppercase tracking-[0.3em] text-cyan-500 dark:text-cyan-300">{"// invite responsibly"}</p>
        <h1 className="mt-5 flex items-center gap-3 text-4xl font-black uppercase tracking-[-0.05em] md:text-6xl">
          <Users aria-hidden="true" className="size-8 text-cyan-700 dark:text-cyan-200 md:size-10" />
          Referrals
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          Invite people you know, follow the program terms, and track referral status and reward conditions.
        </p>
        <ReferralDashboard />
      </section>
      <Footer />
    </main>
  )
}
