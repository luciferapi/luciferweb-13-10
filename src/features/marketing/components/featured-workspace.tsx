"use client"

import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight } from "lucide-react"

export function FeaturedWorkspace() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="relative isolate overflow-hidden bg-muted/40 px-6 py-24 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.45),rgba(168,85,247,0.45),transparent)]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-50 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:56px_56px]"
        style={{
          maskImage: "radial-gradient(ellipse 75% 65% at 50% 50%, #000 35%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 65% at 50% 50%, #000 35%, transparent 100%)",
        }}
      />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 top-0 h-80 w-80 rounded-full bg-cyan-400/25 blur-[110px] dark:bg-cyan-500/25"
        animate={reduceMotion ? undefined : { x: [0, 70, 0], y: [0, 45, 0], scale: [1, 1.18, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-fuchsia-400/25 blur-[110px] dark:bg-fuchsia-500/25"
        animate={reduceMotion ? undefined : { x: [0, -60, 0], y: [0, -40, 0], scale: [1, 1.22, 1] }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-[28rem] rounded-full bg-violet-400/15 blur-[120px] dark:bg-violet-600/20"
        style={{ translateX: "-50%", translateY: "-50%" }}
        animate={reduceMotion ? undefined : { opacity: [0.5, 0.9, 0.5], scale: [1, 1.12, 1] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="group relative mx-auto max-w-6xl"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
        whileHover={reduceMotion ? undefined : { y: -6 }}
      >
        <motion.div
          className="pointer-events-none absolute -inset-8 rounded-[48px] bg-[radial-gradient(circle_at_18%_50%,rgba(34,211,238,0.28),transparent_55%),radial-gradient(circle_at_82%_50%,rgba(168,85,247,0.28),transparent_55%)] blur-3xl"
          aria-hidden="true"
          animate={reduceMotion ? undefined : { opacity: [0.45, 0.85, 0.45], scale: [1, 1.05, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative overflow-hidden rounded-[28px] p-px">
          <motion.div
            className="absolute left-1/2 top-1/2 h-[240%] w-[240%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(34,211,238,0.95)_35deg,rgba(168,85,247,0.95)_85deg,transparent_135deg,transparent_360deg)]"
            style={{ translateX: "-50%", translateY: "-50%" }}
            aria-hidden="true"
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
          />

          <div className="relative overflow-hidden rounded-[27px] bg-card/95 p-6 backdrop-blur-xl md:p-8">
            <motion.div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.14)_50%,transparent_75%)]"
              aria-hidden="true"
              initial={{ x: "-120%" }}
              animate={reduceMotion ? undefined : { x: ["-120%", "120%"] }}
              transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 3.5, ease: "easeInOut" }}
            />

            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">
                  <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                    <motion.span
                      className="absolute inline-flex h-full w-full rounded-full bg-cyan-400"
                      animate={reduceMotion ? undefined : { scale: [1, 2.6, 1], opacity: [0.7, 0, 0.7] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
                    />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  </span>
                  Featured workspace
                </p>

                <motion.h2
                  className="mt-2 bg-[linear-gradient(110deg,var(--foreground)_38%,#22d3ee_48%,#a855f7_55%,var(--foreground)_64%)] bg-clip-text text-2xl font-bold text-transparent md:text-3xl"
                  style={{ backgroundSize: "260% 100%" }}
                  animate={reduceMotion ? undefined : { backgroundPosition: ["180% 0%", "-60% 0%"] }}
                  transition={{ duration: 5.5, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
                >
                  Build your own web experience with AI.
                </motion.h2>
              </div>

              <motion.a
                href="/chat"
                className="group/btn relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full border border-cyan-600/30 bg-cyan-500/10 px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-cyan-800 transition-colors hover:bg-cyan-500/20 dark:border-cyan-300/40 dark:text-cyan-200"
                initial="rest"
                animate="rest"
                whileHover="hover"
                whileTap={{ scale: 0.97 }}
                variants={{ rest: { scale: 1 }, hover: { scale: 1.03 } }}
                transition={{ type: "spring" as const, stiffness: 400, damping: 17 }}
              >
                <motion.span
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent dark:via-white/30"
                  aria-hidden="true"
                  variants={{ rest: { x: "-100%" }, hover: { x: "200%" } }}
                  transition={{ duration: 0.7, ease: "easeInOut" }}
                />
                <span className="relative z-10">Launch chat</span>
                <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" aria-hidden="true" />
              </motion.a>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
