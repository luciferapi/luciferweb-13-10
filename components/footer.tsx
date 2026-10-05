"use client"

import { motion, useInView } from "framer-motion"
import { useState, useRef } from "react"
import Link from "next/link"

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

const exploreLinkHrefs: Record<string, string> = {
  About: "/about",
  APIs: "/api-explorer",
  Contact: "/contact",
}

export function Footer() {
  const [email, setEmail] = useState("")
  const [isHovering, setIsHovering] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const footerRef = useRef(null)
  const isInView = useInView(footerRef, { once: true, margin: "-100px" })

  const handleSubmit = () => {
    setIsSubmitting(true)
    setTimeout(() => setIsSubmitting(false), 2000)
  }

  const footerLinks = [
    { title: "Explore", links: ["About", "APIs", "Contact"] },
    { title: "Build with", links: ["Python", "Next.js", "AI", "Automation"] },
    { title: "Connect", links: ["GitHub", "LinkedIn", "Instagram", "Email"] },
  ]

  return (
    <footer ref={footerRef} id="contact" className="relative overflow-hidden bg-background py-16 pb-6 text-foreground">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-center mb-12"
        >
          <h2 className="overflow-hidden text-4xl font-black leading-[0.9] tracking-tighter text-foreground md:text-6xl">
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
          className="max-w-xl mx-auto mb-12"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <motion.div className="flex-1 relative" whileFocus={{ scale: 1.02 }}>
              <motion.input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full rounded-xl border-2 border-input bg-muted/50 px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-[#AFFF00] focus:outline-none transition-all duration-300"
                whileFocus={{ borderColor: "#AFFF00" }}
              />
              <motion.div
                className="absolute inset-0 rounded-xl pointer-events-none"
                animate={email.length > 0 ? { boxShadow: "0 0 20px rgba(175,255,0,0.2)" } : { boxShadow: "none" }}
              />
            </motion.div>
            <motion.button
              className="bg-[#AFFF00] text-[#121212] px-6 py-3 rounded-xl font-bold text-sm tracking-wide whitespace-nowrap relative overflow-hidden"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring" as const, stiffness: 400, damping: 17 }}
              onClick={handleSubmit}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                initial={{ x: "-100%" }}
                whileHover={{ x: "100%" }}
                transition={{ duration: 0.5 }}
              />
              <motion.span
                className="relative z-10"
                animate={isSubmitting ? { opacity: [1, 0.5, 1] } : {}}
                transition={{ duration: 0.5, repeat: isSubmitting ? Number.POSITIVE_INFINITY : 0 }}
              >
                {isSubmitting ? "Joining..." : "Join the lab"}
              </motion.span>
            </motion.button>
          </div>
          <motion.p
            className="mt-2 text-center font-mono text-xs text-muted-foreground"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            Updates on new experiments. No spam.
          </motion.p>
        </motion.div>

        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <p className="mx-auto max-w-xl font-mono text-xs leading-relaxed text-muted-foreground">
              LUCIFER AI is a personal technology lab by K Praveenkumar — exploring code, AI, APIs, and creative systems. Build something useful, then share what you learned.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-2 gap-6 border-t border-border py-8 md:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {footerLinks.map((section) => (
            <motion.div key={section.title} variants={itemVariants}>
              <h4 className="mb-3 text-sm font-bold text-foreground">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((item) => (
                  <li key={item}>
                    <motion.div whileHover={{ x: 4 }} transition={{ type: "spring" as const, stiffness: 400, damping: 17 }}>
                      <Link
                        href={exploreLinkHrefs[item] ?? "#"}
                        className="inline-block font-mono text-xs text-muted-foreground transition-colors hover:text-cyan-700 dark:hover:text-cyan-300"
                      >
                        {item}
                      </Link>
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
