import type { Metadata } from "next"
import { NetworkStatusScreen } from "@/features/network/components/network-status-screen"

export const metadata: Metadata = {
  title: "Slow Connection Help | LUCIFER AI",
  description: "Troubleshoot a slow internet connection and learn how to continue using LUCIFER AI.",
  robots: { index: false, follow: false },
}

export default function SlowInternetPage() {
  return <NetworkStatusScreen status="slow" />
}
