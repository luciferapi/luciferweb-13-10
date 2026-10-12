"use client"

import { useEffect, useState } from "react"
import { FolderKanban, ShoppingBag } from "lucide-react"

type PublicStats = {
  totalProjects: number
  totalPurchases: number
}

const initialStats: PublicStats = { totalProjects: 0, totalPurchases: 0 }

export function LiveHomeStats() {
  const [stats, setStats] = useState<PublicStats>(initialStats)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const response = await fetch("/api/public-stats", { cache: "no-store" })
        if (!response.ok) return
        const nextStats = (await response.json()) as PublicStats
        if (active) setStats(nextStats)
      } catch {
        // The homepage remains useful if stats are temporarily unavailable.
      }
    }

    void load()
    const timer = window.setInterval(load, 30_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  return (
    <section aria-label="Live platform stats" className="border-y border-border bg-muted/20 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-background/70 px-5 py-4">
          <FolderKanban className="h-5 w-5 text-lime-500" aria-hidden="true" />
          <div>
            <p className="text-2xl font-black tracking-tight text-foreground">{stats.totalProjects.toLocaleString()}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Live projects</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-background/70 px-5 py-4">
          <ShoppingBag className="h-5 w-5 text-lime-500" aria-hidden="true" />
          <div>
            <p className="text-2xl font-black tracking-tight text-foreground">{stats.totalPurchases.toLocaleString()}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Completed buys</p>
          </div>
        </div>
      </div>
    </section>
  )
}
