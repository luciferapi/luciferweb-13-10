import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "Wallet Withdrawals | LUCIFER AI",
  description: "Check withdrawal availability and current wallet payout information for LUCIFER AI.",
  robots: { index: false, follow: false },
}

export default function WalletWithdrawPage() {
  return (
    <main className="min-h-[100dvh] bg-zinc-950 px-4 pb-16 pt-24 text-zinc-50 dark:bg-zinc-950 dark:text-zinc-400 sm:px-6 sm:pt-28">
      <section className="mx-auto max-w-2xl">
        <Link
          href="/wallet"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-zinc-300 transition hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to wallet
        </Link>
        <header className="mt-6">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100 dark:text-zinc-50 sm:text-4xl">
            Withdrawals are coming soon
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-300 dark:text-zinc-400">
            Wallet balances are currently available for project and paid API purchases. Cash withdrawal requests are not open yet.
          </p>
        </header>
        <section className="mt-7 rounded-2xl border border-white/10 bg-zinc-900 p-5 dark:border-white/10 dark:bg-zinc-900 sm:p-7">
          <p className="text-sm font-semibold text-zinc-100 dark:text-zinc-50">Coming soon</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300 dark:text-zinc-400">
            You can continue using your available wallet balance at project and paid API checkout.
          </p>
        </section>
      </section>
    </main>
  )
}
