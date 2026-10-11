import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Transaction History | LUCIFER AI",
  description: "View your LUCIFER AI wallet transaction history.",
  robots: { index: false, follow: false },
}

export default function TransactionHistoryRedirect() {
  redirect("/wallet#transaction-history")
}
