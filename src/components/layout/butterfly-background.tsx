"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

const hiddenRoutes = ["/api-explorer", "/projects", "/chat", "/contact", "/owner", "/wallet", "/transactions", "/login"]

export function ButterflyBackground() {
  const pathname = usePathname()
  const [shouldLoadAnimation, setShouldLoadAnimation] = useState(false)
  const shouldHide = hiddenRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))

  useEffect(() => {
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }).connection
    const slowConnection = connection?.saveData ||
      (connection?.effectiveType && connection.effectiveType !== "4g")

    if (
      !navigator.onLine ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      slowConnection
    ) return

    const timer = window.setTimeout(() => setShouldLoadAnimation(true), 2500)
    return () => window.clearTimeout(timer)
  }, [])

  if (shouldHide) return null

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {shouldLoadAnimation ? (
        <div className="butterfly-real">
          <img
            src="/images/Butterfly_o_Mariposa.webp"
            alt=""
            decoding="async"
            fetchPriority="low"
            className="butterfly-real-image"
          />
        </div>
      ) : null}
    </div>
  )
}
