import Link from "next/link"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  ReceiptText,
} from "lucide-react"
import { WalletAnimated } from "@/components/wallet-animated"
import { WalletDepositControl } from "@/components/wallet-deposit-control"
import { WalletTransactionHistory } from "@/components/wallet-transaction-history"
import { requireSignedInUser } from "@/lib/auth-session"
import { getAvailableWalletBalancePaise } from "@/lib/wallet-withdrawal-store"

const quickActions = [
  { label: "Deposit", icon: ArrowDownToLine },
  { label: "Withdraw", icon: ArrowUpFromLine },
]

const historyTiles = [
  {
    title: "Transaction history",
    subtitle: "View all activity",
    icon: ReceiptText,
    href: "#transaction-history",
  },
  {
    title: "Deposit history",
    subtitle: "View deposit activity",
    icon: History,
    href: "/wallet?history=deposit#transaction-history",
  },
  {
    title: "Withdraw history",
    subtitle: "View withdrawal activity",
    icon: ArrowUpFromLine,
    href: "/wallet?history=withdraw#transaction-history",
  },
] as const

export default async function WalletPage() {
  const user = await requireSignedInUser("/wallet")
  const balancePaise = await getAvailableWalletBalancePaise(user.id)

  return (
    <WalletAnimated>
      <main className="min-h-[100dvh] bg-[#f4f5fb] text-[#172033] dark:bg-[#101216] dark:text-slate-100">
        <section className="mx-auto min-h-[70vh] max-w-5xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
          <header data-wallet-intro className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              Wallet
            </h1>
            <p className="mt-2 max-w-[60ch] text-sm leading-6 text-slate-600 dark:text-slate-300">
              Review your balance and payment activity.
            </p>
          </header>

          <section
            aria-label="Wallet balance"
            data-wallet-intro
            className="mt-7 flex flex-wrap items-end justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-7"
          >
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Available balance</p>
              <p className="mt-2 font-mono text-4xl font-bold tracking-tight tabular-nums text-slate-950 dark:text-white sm:text-5xl">
                {(balancePaise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
              </p>
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">INR</p>
          </section>

          <section
            aria-label="Wallet actions"
            className="mt-7 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4"
          >
              {quickActions.map(({ label, icon: Icon }) => (
                label === "Deposit" ? (
                  <WalletDepositControl key={label} />
                ) : (
                <Link
                  key={label}
                  href="/wallet/withdraw"
                  className="wallet-action group flex min-h-24 flex-col items-center justify-center gap-3 rounded-xl border border-transparent text-center text-sm font-semibold text-slate-700 transition hover:border-slate-200 hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800/70 dark:focus-visible:ring-offset-slate-900"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-100 dark:bg-blue-950/70 dark:text-blue-300 dark:group-hover:bg-blue-900/70">
                    <Icon aria-hidden="true" size={21} />
                  </span>
                  <span>{label}</span>
                </Link>
                )
              ))}
          </section>

          <p className="mt-3 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
            Deposits are processed securely by Razorpay. Withdrawal requests are reviewed by the owner.
          </p>

          <section aria-labelledby="wallet-history-heading" className="mt-12">
            <h2 id="wallet-history-heading" className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Wallet history
            </h2>
            <div aria-label="Wallet history" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {historyTiles.map(({ title, subtitle, icon: Icon, ...destination }) => {
                const contents = (
                  <>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
                      <Icon aria-hidden="true" size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</span>
                      <span className="mt-0.5 block text-xs leading-4 text-slate-600 dark:text-slate-400">{subtitle}</span>
                    </span>
                  </>
                )

                return "href" in destination ? (
                  <Link
                    key={title}
                    href={destination.href}
                    data-wallet-history-card
                    className="flex min-h-[88px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(31,41,55,0.03)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800 dark:focus-visible:ring-offset-slate-950"
                  >
                    {contents}
                  </Link>
                ) : (
                  <div
                    key={title}
                    aria-disabled="true"
                    title={`${title} is not available yet.`}
                    data-wallet-history-card
                    className="flex min-h-[88px] cursor-not-allowed items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 opacity-65 shadow-[0_2px_8px_rgba(31,41,55,0.03)] dark:border-slate-800 dark:bg-slate-900"
                  >
                    {contents}
                  </div>
                )
              })}
            </div>
          </section>
          <WalletTransactionHistory />
        </section>
      </main>
    </WalletAnimated>
  )
}
