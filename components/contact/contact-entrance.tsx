"use client"

import { useEffect, useRef, type ReactNode } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

export function ContactEntrance({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const media = gsap.matchMedia(root)
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const timeline = gsap.timeline()
      timeline
        .from("[data-contact-intro] > p", {
          autoAlpha: 0,
          y: 12,
          duration: 0.4,
          ease: "power3.out",
        })
        .from(
          "[data-contact-word]",
          {
            yPercent: 110,
            rotate: 2,
            duration: 0.72,
            stagger: 0.075,
            ease: "power4.out",
          },
          "-=0.12",
        )
        .from(
          "[data-contact-intro] > a",
          {
            autoAlpha: 0,
            y: 10,
            duration: 0.4,
            ease: "power3.out",
          },
          "-=0.35",
        )
        .from(
          "[data-contact-form] > p, [data-contact-form] > h2",
          {
            autoAlpha: 0,
            y: 12,
            duration: 0.42,
            stagger: 0.08,
            ease: "power3.out",
          },
          "-=0.25",
        )

      gsap.from("[data-contact-service]", {
        autoAlpha: 0,
        y: 14,
        stagger: 0.07,
        duration: 0.45,
        ease: "power2.out",
        scrollTrigger: {
          trigger: "[data-contact-services]",
          start: "top 86%",
          once: true,
        },
      })

      gsap.utils.toArray<HTMLElement>("[data-contact-field]").forEach((field) => {
        gsap.from(field, {
          autoAlpha: 0,
          y: 12,
          duration: 0.4,
          ease: "power2.out",
          scrollTrigger: {
            trigger: field,
            start: "top 92%",
            once: true,
          },
        })
      })

      return () => timeline.kill()
    })

    return () => media.revert()
  }, [])

  return <div ref={rootRef} className="contents">{children}</div>
}
