'use client'

import { ArrowLeft } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

export function BackButton() {
  const pathname = usePathname()
  const router = useRouter()

  if (pathname === "/" || pathname === "/chat") return null

  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className="fixed left-4 top-4 z-50 inline-flex min-w-max shrink-0 items-center gap-2 rounded-full border border-border/80 bg-background/85 px-3 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-cyan-500/70 hover:text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label="Go back"
    >
      <ArrowLeft className="shrink-0" size={16} aria-hidden="true" />
      <span className="inline-block shrink-0 whitespace-nowrap">Back</span>
    </button>
  )
}
