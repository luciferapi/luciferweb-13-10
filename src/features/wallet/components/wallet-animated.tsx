"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"

export function WalletAnimated({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const media = gsap.matchMedia()
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        const intro = root.querySelectorAll<HTMLElement>("[data-wallet-intro]")
        const actions = root.querySelectorAll<HTMLElement>(".wallet-action")
        const historyCards = root.querySelectorAll<HTMLElement>("[data-wallet-history-card]")

        gsap.timeline()
          .fromTo(
            intro,
            { y: 12 },
            { y: 0, duration: 0.45, ease: "power3.out", stagger: 0.07, clearProps: "transform" },
          )
          .fromTo(
            actions,
            { y: 10 },
            { y: 0, duration: 0.4, ease: "power3.out", stagger: 0.05, clearProps: "transform" },
            "-=0.22",
          )
          .fromTo(
            historyCards,
            { y: 12 },
            { y: 0, duration: 0.45, ease: "power3.out", stagger: 0.06, clearProps: "transform" },
            "-=0.18",
          )
      }, root)

      return () => context.revert()
    })

    return () => media.revert()
  }, [])

  return <div ref={rootRef}>{children}</div>
}
