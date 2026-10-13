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
    <main className="min-h-[100dvh] bg-[#f4f5fb] px-4 pb-16 pt-24 text-[#172033] dark:bg-[#101216] dark:text-slate-100 sm:px-6 sm:pt-28">
      <section className="mx-auto max-w-2xl">
        <Link
          href="/wallet"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-slate-700 transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to wallet
        </Link>
        <header className="mt-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Withdrawals are coming soon
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Wallet balances are currently available for project and paid API purchases. Cash withdrawal requests are not open yet.
          </p>
        </header>
        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-7">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Coming soon</p>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            You can continue using your available wallet balance at project and paid API checkout.
          </p>
        </section>
      </section>
    </main>
  )
}
