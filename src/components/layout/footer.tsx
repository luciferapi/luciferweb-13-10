"use client"

import { motion, useInView } from "framer-motion"
import { useState, useRef } from "react"
import Link from "next/link"
import { COOKIE_SETTINGS_EVENT } from "@/components/layout/cookie-consent-events"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 20,
    },
  },
}

type FooterLink =
  | { label: string; href: string; external?: boolean }
  | { label: string; action: "cookie-settings" }

export function Footer() {
  const [isHovering, setIsHovering] = useState(false)
  const footerRef = useRef(null)
  const isInView = useInView(footerRef, { once: true, margin: "-100px" })

  const footerLinks: { title: string; links: FooterLink[] }[] = [
    {
      title: "Explore",
      links: [
        { label: "Start a project", href: "/contact#project-request" },
        { label: "Support", href: "/support" },
        { label: "About", href: "/about" },
      ],
    },
    {
      title: "Build",
      links: [
        { label: "Real websites", href: "/#services" },
        { label: "APIs", href: "/api-explorer" },
        { label: "Academic projects", href: "/#academic-projects" },
        { label: "Automations", href: "/#services" },
      ],
    },
    {
      title: "Connect",
      links: [
        { label: "Instagram", href: "https://instagram.com/luciferai.dev", external: true },
        { label: "Email", href: "mailto:lucifer@luciferapi.com" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms and Conditions", href: "/terms" },
        { label: "Cookie settings", action: "cookie-settings" },
      ],
    },
  ]

  return (
    <footer ref={footerRef} id="contact" className="relative overflow-hidden bg-background py-20 pb-6 text-foreground">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
          className="mb-12 text-center"
        >
          <h2 className="overflow-hidden text-[clamp(2.5rem,5vw,5rem)] font-black leading-[0.9] tracking-[-0.08em] text-foreground">
            <motion.span
              className="block"
              initial={{ y: 100 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
            >
              READY TO
            </motion.span>
            <motion.span
              className="block text-[#AFFF00]"
              initial={{ y: 100 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1], delay: 0.1 }}
            >
              BUILD NEXT?
            </motion.span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mb-12 max-w-xl"
        >
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/contact#project-request"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#AFFF00] px-6 py-3 text-center text-sm font-bold tracking-wide text-[#121212] transition hover:-translate-y-px hover:bg-[#D9FF70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AFFF00] focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] sm:w-auto"
            >
              Start a project · ₹1 fee
            </Link>
            <Link
              href="/contact/process"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-border px-6 py-3 text-center text-sm font-semibold text-foreground transition hover:-translate-y-px hover:border-cyan-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] sm:w-auto"
            >
              See how it works
            </Link>
          </div>
          <motion.p
            className="mt-3 text-center font-mono text-xs leading-5 text-muted-foreground"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            Project requests require a verified account and a non-refundable ₹1 fee.
          </motion.p>
        </motion.div>

        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.35 }}
        >
          <p className="mx-auto max-w-xl font-mono text-xs leading-relaxed text-muted-foreground">
              LUCIFER AI builds real websites, APIs, academic projects, and automations for ideas that need to work in the real world.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-2 gap-6 border-t border-border py-8 md:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {footerLinks.map((section) => (
            <motion.div key={section.title} variants={itemVariants}>
              <h4 className="mb-3 text-sm font-bold text-foreground">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((item) => (
                  <li key={item.label}>
                    <motion.div whileHover={{ x: 4 }} transition={{ type: "spring" as const, stiffness: 400, damping: 17 }}>
                      {"action" in item ? (
                        <button
                          type="button"
                          onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}
                          className="inline-block font-mono text-xs text-muted-foreground transition-colors hover:text-cyan-700 dark:hover:text-cyan-300"
                        >
                          {item.label}
                        </button>
                      ) : (
                        <Link
                          href={item.href}
                          target={item.external ? "_blank" : undefined}
                          rel={item.external ? "noreferrer" : undefined}
                          className="inline-block font-mono text-xs text-muted-foreground transition-colors hover:text-cyan-700 dark:hover:text-cyan-300"
                        >
                          {item.label}
                        </Link>
                      )}
                    </motion.div>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="flex flex-col items-center justify-between gap-3 border-t border-border pt-6 md:flex-row"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          <motion.div
            className="flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring" as const, stiffness: 400, damping: 17 }}
          >
            <span className="flex items-center gap-3 text-xl font-black">
              <span className="size-9 overflow-hidden rounded-xl border border-fuchsia-400/40"><img src="/images/luciferai-brand-logo.jpg" alt="LUCIFER AI cat mascot logo" className="size-full object-cover" /></span>
              <span><span className="text-foreground">LUCIFER</span> <span className="text-cyan-700 dark:text-cyan-300">AI</span></span>
            </span>
          </motion.div>

          <p className="font-mono text-xs text-muted-foreground">© 2026 LUCIFER AI. All rights reserved.</p>

          <motion.p
            className="cursor-pointer font-mono text-xs text-muted-foreground"
            onHoverStart={() => setIsHovering(true)}
            onHoverEnd={() => setIsHovering(false)}
            animate={
              isHovering
                ? {
                    rotate: [0, -5, 5, -5, 5, 0],
                    scale: [1, 1.1, 1],
                    color: "#AFFF00",
                  }
                : {
                    rotate: 0,
                    scale: 1,
                    color: "var(--muted-foreground)",
                  }
            }
            transition={{ duration: 0.5 }}
          >
            made with curiosity
          </motion.p>
        </motion.div>
      </div>

      <motion.div
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 select-none whitespace-nowrap text-[clamp(2rem,10vw,10rem)] font-black leading-none text-foreground/[0.02]"
        initial={{ y: 100, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: "easeOut" }}
> LUCIFER AI

      </motion.div>
    </footer>
  )
}
