'use client'

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { MaintenanceScreen, type MaintenanceScreenEntry } from "@/features/maintenance/components/maintenance-screen"

const ignoredPaths = ["/owner/maintenance", "/api", "/_next"]

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [entry, setEntry] = useState<MaintenanceScreenEntry | null>(null)

  useEffect(() => {
    if (
      !pathname ||
      ignoredPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
    ) {
      setEntry(null)
      return
    }

    let active = true
    fetch(`/api/maintenance/check?path=${encodeURIComponent(pathname)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Maintenance status request failed with status ${response.status}.`)
        }
        const body = await response.text()
        if (!body.trim()) return null
        try {
          const result = JSON.parse(body) as { maintenance?: MaintenanceScreenEntry | null }
          return result.maintenance ?? null
        } catch {
          throw new Error("The maintenance status response was not valid JSON.")
        }
      })
      .then((nextEntry) => {
        if (active) setEntry(nextEntry)
      })
      .catch((error: unknown) => {
        console.error("Could not check maintenance status.", error)
        if (active) setEntry(null)
      })

    return () => {
      active = false
    }
  }, [pathname])

  if (entry) return <MaintenanceScreen entry={entry} />
  return <>{children}</>
}
