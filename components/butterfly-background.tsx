"use client"

import { usePathname } from "next/navigation"

const hiddenRoutes = ["/api-explorer", "/projects", "/chat", "/owner"]

export function ButterflyBackground() {
  const pathname = usePathname()
  const shouldHide = hiddenRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))

  if (shouldHide) return null

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <div className="butterfly-real">
        <img src="/images/Butterfly_o_Mariposa.gif" alt="" className="butterfly-real-image" />
      </div>
    </div>
  )
}
