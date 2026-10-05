import { OwnerProjectsPanel } from "@/components/owner-projects-panel"
import { OwnerReferralsPanel } from "@/components/owner-referrals-panel"

export const dynamic = "force-dynamic"
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function OwnerPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-36">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">{"// owner dashboard"}</p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.04em] md:text-6xl">Dashboard</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">Manage API and project cards, and configure the live API Explorer endpoint catalog separately.</p>
      </section>
      <OwnerReferralsPanel />
      <OwnerProjectsPanel />
    </main>
  )
}