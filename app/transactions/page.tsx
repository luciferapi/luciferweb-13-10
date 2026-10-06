import { redirect } from "next/navigation"

export default function TransactionHistoryRedirect() {
  redirect("/wallet#transaction-history")
}
