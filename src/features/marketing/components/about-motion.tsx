"use client"

import { useEffect, useRef, type ReactNode } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useLenis } from "lenis/react"

gsap.registerPlugin(ScrollTrigger)

export function AboutMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const lenis = useLenis()

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    lenis?.on("scroll", ScrollTrigger.update)

    const media = gsap.matchMedia(root)

    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap.from("[data-about-intro] > *", {
          autoAlpha: 0,
          y: 18,
          duration: 0.65,
          stagger: 0.09,
          ease: "power3.out",
        })

        gsap.fromTo(
          "[data-about-image]",
          { scale: 1, autoAlpha: 1 },
          {
            scale: 1.08,
            autoAlpha: 0.3,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-about-hero]",
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          },
        )

        gsap.from("[data-about-service]", {
          autoAlpha: 0,
          y: 24,
          duration: 0.6,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: "[data-about-grid]",
            start: "top 82%",
            once: true,
          },
        })
      }, root)

      return () => context.revert()
    })

    media.add(
      "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
      () => {
        const context = gsap.context(() => {
          ScrollTrigger.create({
            trigger: "[data-about-capabilities]",
            pin: "[data-about-pin]",
            start: "top 18%",
            endTrigger: "[data-about-grid]",
            end: "bottom bottom",
            pinSpacing: false,
            invalidateOnRefresh: true,
          })
        }, root)

        return () => context.revert()
      },
    )

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
