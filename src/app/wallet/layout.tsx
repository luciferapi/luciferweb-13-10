import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Wallet and Deposits | LUCIFER AI",
  description: "Manage your LUCIFER AI wallet, deposits, and transaction history.",
  robots: { index: false, follow: false },
}

export default function WalletLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
