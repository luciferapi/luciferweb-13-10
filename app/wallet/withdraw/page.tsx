import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { WalletWithdrawalForm } from "@/components/wallet-withdrawal-form"
import { requireSignedInUser } from "@/lib/auth-session"
import { getWithdrawalMethod } from "@/lib/withdrawal-method-store"
import {
  getAvailableWalletBalancePaise,
  getDailyWithdrawalRequestCount,
  MAX_DAILY_WITHDRAWAL_REQUESTS,
} from "@/lib/wallet-withdrawal-store"

export default async function WalletWithdrawPage() {
  const user = await requireSignedInUser("/wallet/withdraw")
  const [availableBalancePaise, requestCount, withdrawalMethod] = await Promise.all([
    getAvailableWalletBalancePaise(user.id),
    getDailyWithdrawalRequestCount(user.id),
    getWithdrawalMethod(user.id),
  ])

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
            Request a withdrawal
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Requests are sent to the owner for review. Each request must be ₹50-₹1,500, with up to four requests per day.
          </p>
        </header>

        <WalletWithdrawalForm
          availableBalancePaise={availableBalancePaise}
          remainingRequests={Math.max(0, MAX_DAILY_WITHDRAWAL_REQUESTS - requestCount)}
          withdrawalMethod={withdrawalMethod}
        />
      </section>
    </main>
  )
}
