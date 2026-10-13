import Link from "next/link"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  ReceiptText,
} from "lucide-react"
import { WalletAnimated } from "@/features/wallet/components/wallet-animated"
import { WalletDepositControl } from "@/features/wallet/components/wallet-deposit-control"
import { WalletTransactionHistory } from "@/features/wallet/components/wallet-transaction-history"
import { getSignedInUser } from "@/features/auth/server/auth-session"
import { getAvailableWalletBalancePaise } from "@/features/wallet/server/wallet-withdrawal-store"

export const dynamic = "force-dynamic"

const quickActions = [
  { label: "Deposit", icon: ArrowDownToLine },
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
    title: "Withdrawals",
    subtitle: "Coming soon",
    icon: ArrowUpFromLine,
  },
] as const

function WalletUnavailable({ message }: { message: string }) {
  return (
    <WalletAnimated>
      <main className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,color-mix(in_oklch,#dbeafe_42%,transparent),transparent_42%),#f4f5fb] text-[#172033] dark:bg-[radial-gradient(circle_at_top,color-mix(in_oklch,#172554_28%,transparent),transparent_40%),#101216] dark:text-slate-100">
        <section className="mx-auto flex min-h-[70vh] max-w-5xl items-center px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
          <div className="w-full max-w-2xl rounded-2xl border border-amber-200 bg-white/90 p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)] backdrop-blur dark:border-amber-900/60 dark:bg-slate-900/90 dark:shadow-none sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">LUCIFER AI WALLET</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Wallet is temporarily unavailable</h1>
            <p className="mt-3 max-w-[58ch] text-sm leading-6 text-slate-600 dark:text-slate-300">{message}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/wallet" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 active:scale-[0.98]">Reload wallet</Link>
              <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 active:scale-[0.98] dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Back to home</Link>
            </div>
          </div>
        </section>
      </main>
    </WalletAnimated>
  )
}

export default async function WalletPage() {
  let user: Awaited<ReturnType<typeof getSignedInUser>>
  try {
    user = await getSignedInUser()
  } catch (error) {
    console.error("Could not load the wallet session.", error)
    return <WalletUnavailable message="We could not verify your account right now. Please reload the wallet in a moment." />
  }

  if (!user) {
    return (
      <WalletAnimated>
        <main className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,color-mix(in_oklch,#dbeafe_42%,transparent),transparent_42%),#f4f5fb] text-[#172033] dark:bg-[radial-gradient(circle_at_top,color-mix(in_oklch,#172554_28%,transparent),transparent_40%),#101216] dark:text-slate-100">
          <section className="mx-auto flex min-h-[70vh] max-w-5xl items-center px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
            <div className="w-full max-w-2xl rounded-2xl border border-blue-100 bg-white/90 p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">LUCIFER AI WALLET</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Your wallet is ready</h1>
              <p className="mt-3 max-w-[58ch] text-sm leading-6 text-slate-600 dark:text-slate-300">
                Sign in to view your balance, add funds securely, and review wallet activity. Your financial information is only available inside your account.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/login?next=%2Fwallet"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 active:scale-[0.98]"
                >
                  Sign in to wallet
                </Link>
                <Link
                  href="/"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 active:scale-[0.98] dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Back to home
                </Link>
              </div>
            </div>
          </section>
        </main>
      </WalletAnimated>
    )
  }

  let balancePaise: number | null = null
  try {
    balancePaise = await getAvailableWalletBalancePaise(user.id)
  } catch (error) {
    console.error("Could not load the wallet balance.", error)
  }

  return (
    <WalletAnimated>
      <main className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,color-mix(in_oklch,#dbeafe_42%,transparent),transparent_42%),#f4f5fb] text-[#172033] dark:bg-[radial-gradient(circle_at_top,color-mix(in_oklch,#172554_28%,transparent),transparent_40%),#101216] dark:text-slate-100">
        <section className="mx-auto min-h-[70vh] max-w-5xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
          <header data-wallet-intro className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              Wallet
            </h1>
            <p className="mt-2 max-w-[60ch] text-sm leading-6 text-slate-600 dark:text-slate-300">
              Use your balance for project and paid API purchases. Cash withdrawals are coming soon.
            </p>
          </header>

          <section
            aria-label="Wallet balance"
            data-wallet-intro
            className="mt-7 flex flex-wrap items-end justify-between gap-5 rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none sm:p-7"
          >
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Available balance</p>
              <p className="mt-2 font-mono text-4xl font-bold tracking-tight tabular-nums text-slate-950 dark:text-white sm:text-5xl">
                {balancePaise === null ? "Unavailable" : (balancePaise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
              </p>
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">INR</p>
          </section>

          {balancePaise === null ? (
            <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              Your wallet balance is temporarily unavailable. You can reload this page to try again.
            </p>
          ) : null}

          <section
            aria-label="Wallet actions"
            className="mt-7 grid grid-cols-2 gap-3 rounded-2xl border border-blue-100 bg-white/90 p-3 shadow-[0_10px_28px_rgba(15,23,42,0.04)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none sm:p-4"
          >
            {quickActions.map(({ label }) => <WalletDepositControl key={label} />)}
            <div
                aria-disabled="true"
                className="flex min-h-24 cursor-not-allowed flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <ArrowUpFromLine aria-hidden="true" size={21} />
                </span>
                <span>Withdrawals · Coming soon</span>
              </div>
          </section>

          <p className="mt-3 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
            Deposits are processed securely by Razorpay. Wallet withdrawals are not available yet.
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
                    title={`${title} are coming soon.`}
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
