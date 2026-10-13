import type { Metadata } from "next"
import { NetworkStatusScreen } from "@/features/network/components/network-status-screen"

export const metadata: Metadata = {
  title: "Offline | LUCIFER AI",
  description: "LUCIFER AI cannot connect right now. Check your internet connection and try again.",
  robots: { index: false, follow: false },
}

export default function NoInternetPage() {
  return <NetworkStatusScreen status="offline" />
}
