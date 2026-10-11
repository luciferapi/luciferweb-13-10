"use client"

import { useEffect, useRef, type ReactNode } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useLenis } from "lenis/react"

gsap.registerPlugin(ScrollTrigger)

export function SettingsMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const lenis = useLenis()

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    lenis?.on("scroll", ScrollTrigger.update)

    const media = gsap.matchMedia(root)
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>("[data-settings-section]").forEach((section) => {
          gsap.from(section, {
            autoAlpha: 0,
            y: 18,
            duration: 0.55,
            ease: "power3.out",
            scrollTrigger: {
              trigger: section,
              start: "top 90%",
              once: true,
            },
          })
        })
      }, root)

      return () => context.revert()
    })

    return () => {
      media.revert()
      lenis?.off("scroll", ScrollTrigger.update)
    }
  }, [lenis])

  return (
    <div ref={rootRef} className="contents">
      {children}
    </div>
  )
}
