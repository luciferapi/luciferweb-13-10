import Link from "next/link"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  History,
  LockKeyhole,
  ReceiptText,
  Sparkles,
  WalletCards,
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
      <main className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,rgba(175,255,0,0.08),transparent_42%),#09090b] text-zinc-50 dark:bg-[radial-gradient(circle_at_top,rgba(175,255,0,0.08),transparent_40%),#09090b] dark:text-zinc-400">
        <section className="mx-auto flex min-h-[70vh] max-w-5xl items-center px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
          <div className="w-full max-w-2xl rounded-2xl border border-amber-400/25 bg-zinc-900/90 p-6 shadow-[0_12px_32px_rgba(0,0,0,0.3)] backdrop-blur dark:border-amber-400/25 dark:bg-zinc-900/90 dark:shadow-none sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300 dark:text-amber-200">LUCIFER AI WALLET</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-100 dark:text-zinc-50 sm:text-4xl">Wallet is temporarily unavailable</h1>
            <p className="mt-3 max-w-[58ch] text-sm leading-6 text-zinc-300 dark:text-zinc-400">{message}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/wallet" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 active:scale-[0.98]">Reload wallet</Link>
              <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 active:scale-[0.98] dark:border-white/10 dark:text-zinc-400 dark:hover:bg-zinc-900">Back to home</Link>
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
        <main className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,rgba(175,255,0,0.08),transparent_42%),#09090b] text-zinc-50 dark:bg-[radial-gradient(circle_at_top,rgba(175,255,0,0.08),transparent_40%),#09090b] dark:text-zinc-400">
          <section className="mx-auto flex min-h-[70vh] max-w-5xl items-center px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
            <div className="w-full max-w-2xl rounded-2xl border border-lime-400/25 bg-zinc-900/90 p-6 shadow-[0_12px_32px_rgba(0,0,0,0.3)] backdrop-blur dark:border-white/10 dark:bg-zinc-900/90 dark:shadow-none sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-300 dark:text-lime-300">LUCIFER AI WALLET</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-100 dark:text-zinc-50 sm:text-4xl">Your wallet is ready</h1>
              <p className="mt-3 max-w-[58ch] text-sm leading-6 text-zinc-300 dark:text-zinc-400">
                Sign in to view your balance, add funds securely, and review wallet activity. Your financial information is only available inside your account.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/login?next=%2Fwallet"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 active:scale-[0.98]"
                >
                  Sign in to wallet
                </Link>
                <Link
                  href="/"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 active:scale-[0.98] dark:border-white/10 dark:text-zinc-400 dark:hover:bg-zinc-900"
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
      <main className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,rgba(175,255,0,0.08),transparent_42%),#09090b] text-zinc-50 dark:bg-[radial-gradient(circle_at_top,rgba(175,255,0,0.08),transparent_40%),#09090b] dark:text-zinc-400">
        <section className="mx-auto min-h-[70vh] max-w-5xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
          <header data-wallet-intro className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-lime-300 dark:text-lime-300"><Sparkles aria-hidden="true" className="size-3.5" /> Personal wallet</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-zinc-100 dark:text-zinc-50 sm:text-5xl">Your money, ready to move.</h1>
              <p className="mt-3 max-w-[58ch] text-sm leading-6 text-zinc-300 dark:text-zinc-400">Fund projects, unlock paid APIs, and keep every wallet activity in one clear place.</p>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300 shadow-sm dark:border-emerald-400/25 dark:bg-emerald-950/40 dark:text-emerald-300 sm:inline-flex"><CheckCircle2 aria-hidden="true" className="size-4" /> Secure account</div>
          </header>

          <section
            aria-label="Wallet balance"
            data-wallet-intro
            className="relative mt-8 overflow-hidden rounded-[1.75rem] border border-lime-400/20 bg-[linear-gradient(120deg,#09090b_0%,#18181b_64%,#09090b_100%)] p-6 text-zinc-50 shadow-[0_22px_60px_rgba(175,255,0,0.08)] sm:p-8"
          >
            <WalletCards aria-hidden="true" className="absolute -right-5 -top-8 size-40 rotate-12 text-zinc-50/10" strokeWidth={1} />
            <div className="relative">
              <div className="flex items-center gap-2 text-sm font-semibold text-lime-100"><span className="size-2 rounded-full bg-lime-300 shadow-[0_0_12px_rgba(175,255,0,0.7)]" /> Available balance</div>
              <p className="mt-4 font-mono text-4xl font-black tracking-tight tabular-nums text-zinc-50 sm:text-6xl">
                {balancePaise === null ? "Unavailable" : (balancePaise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
              </p>
              <p className="mt-3 text-xs text-zinc-400">Ready for project purchases and paid API access</p>
            </div>
            <div className="relative mt-6 flex items-center gap-2 border-t border-white/15 pt-4 text-xs font-medium text-zinc-400"><LockKeyhole aria-hidden="true" className="size-3.5" /> Protected checkout via Razorpay</div>
          </section>

          {balancePaise === null ? (
            <p role="alert" className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-200 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200">
              Your wallet balance is temporarily unavailable. You can reload this page to try again.
            </p>
          ) : null}

          <section
            aria-label="Wallet actions"
            className="mt-7 grid grid-cols-2 gap-3 rounded-[1.5rem] border border-white/10 bg-zinc-900/80 p-3 shadow-[0_14px_38px_rgba(0,0,0,0.3)] backdrop-blur dark:border-white/10 dark:bg-zinc-900/70 dark:shadow-none sm:p-4"
          >
            {quickActions.map(({ label }) => <WalletDepositControl key={label} />)}
            <div
                aria-disabled="true"
                className="flex min-h-24 cursor-not-allowed flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-zinc-900/70 text-center text-sm font-semibold text-zinc-400 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-400"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-zinc-800 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-400">
                  <ArrowUpFromLine aria-hidden="true" size={21} />
                </span>
                <span>Withdrawals · Coming soon</span>
              </div>
          </section>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs leading-5 text-zinc-400 dark:text-zinc-400">
            <LockKeyhole aria-hidden="true" className="size-3.5" /> Deposits are processed securely by Razorpay. Withdrawals are coming soon.
          </p>

          <section aria-labelledby="wallet-history-heading" className="mt-12">
            <h2 id="wallet-history-heading" className="text-2xl font-black tracking-tight text-zinc-100 dark:text-zinc-50">
              Your activity
            </h2>
            <div aria-label="Wallet history" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {historyTiles.map(({ title, subtitle, icon: Icon, ...destination }) => {
                const contents = (
                  <>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime-400/10 text-lime-300 dark:bg-lime-400/10 dark:text-lime-300">
                      <Icon aria-hidden="true" size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-zinc-100 dark:text-zinc-400">{title}</span>
                      <span className="mt-0.5 block text-xs leading-4 text-zinc-300 dark:text-zinc-400">{subtitle}</span>
                    </span>
                  </>
                )

                return "href" in destination ? (
                  <Link
                    key={title}
                    href={destination.href}
                    data-wallet-history-card
                    className="flex min-h-[88px] items-center gap-3 rounded-xl border border-white/10 bg-zinc-900 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5 hover:border-lime-400/25 hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-lime-400/25 dark:focus-visible:ring-offset-zinc-950"
                  >
                    {contents}
                  </Link>
                ) : (
                  <div
                    key={title}
                    aria-disabled="true"
                    title={`${title} are coming soon.`}
                    data-wallet-history-card
                    className="flex min-h-[88px] cursor-not-allowed items-center gap-3 rounded-xl border border-white/10 bg-zinc-900 p-4 opacity-65 shadow-[0_2px_8px_rgba(0,0,0,0.25)] dark:border-white/10 dark:bg-zinc-900"
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
