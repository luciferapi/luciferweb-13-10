import { AboutMotion } from "@/components/about/about-motion"
import { Footer } from "@/components/footer"
import { FeaturedWorkspace } from "@/components/featured-workspace"

const capabilities = [
  {
    title: "Digital foundations",
    span: "lg:col-span-7",
    services: [
      ["Websites", "Modern, responsive websites for personal and professional projects."],
      ["Web applications", "Custom applications with practical interfaces and backend functionality."],
    ],
  },
  {
    title: "Interface craft",
    span: "lg:col-span-5",
    services: [
      ["UI development", "Responsive interfaces for web applications and dashboards."],
      ["UI/UX design", "Clean layouts and user-focused digital experiences."],
    ],
  },
  {
    title: "Connected systems",
    span: "lg:col-span-5",
    services: [
      ["API development", "Create and integrate APIs for connecting applications and services."],
      ["Custom automation", "Automate repetitive tasks and connect different systems."],
    ],
  },
  {
    title: "Small experiments",
    span: "lg:col-span-7",
    services: [
      ["Automated bots", "Custom automation and bot solutions for suitable workflows."],
      ["Mini projects", "Small custom projects for learning, testing, and practical use."],
    ],
  },
] as const

export default function AboutPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <AboutMotion>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <section
            data-about-hero
            className="grid min-h-[calc(100dvh-6rem)] grid-cols-1 items-center gap-12 pb-20 pt-28 md:gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-24 lg:pt-24"
          >
            <div data-about-intro className="relative z-[1]">
              <h1
                data-about-title
                className="max-w-5xl text-[clamp(3.2rem,7vw,6.7rem)] font-black uppercase leading-[0.9] tracking-[-0.075em] text-foreground"
              >
                Learn by building.
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
                I&apos;m a student exploring code, AI, cryptocurrency, and blockchain through practical projects as I build toward a technology career.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a
                  href="#capabilities"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background transition hover:-translate-y-px hover:opacity-85 active:scale-[0.98]"
                >
                  Explore skills
                </a>
                <a
                  href="/contact"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition hover:-translate-y-px hover:border-cyan-300/50 active:scale-[0.98]"
                >
                  Get in touch
                </a>
              </div>
            </div>

            <div
              data-about-visual
              className="relative min-h-[22rem] overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_50%_36%,rgba(34,211,238,0.12),transparent_52%),#09090b] md:min-h-[30rem] lg:min-h-[36rem]"
            >
              <img
                data-about-image
                src="/character-replacement.png"
                alt="LUCIFER AI virtual assistant"
                className="absolute inset-0 h-full w-full object-cover object-[center_28%] contrast-110"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_72%_20%,rgba(34,211,238,0.18),transparent_42%)]"
              />
            </div>
          </section>

          <section
            id="capabilities"
            data-about-capabilities
            className="grid grid-cols-1 gap-10 pb-28 pt-10 md:pb-36 lg:grid-cols-12 lg:gap-12 lg:pb-44"
          >
            <div data-about-pin className="lg:col-span-4 lg:self-start lg:pt-8">
              <h2 className="max-w-sm text-4xl font-bold leading-[1.02] tracking-[-0.065em] md:text-5xl">
                From first idea to finished interface.
              </h2>
              <p className="mt-5 max-w-sm text-base leading-7 text-muted-foreground">
                I learn by making practical things, connecting systems, and improving each build along the way.
              </p>
            </div>

            <div
              data-about-grid
              className="grid grid-flow-dense grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-12"
            >
              {capabilities.map((capability) => (
                <article
                  key={capability.title}
                  data-about-service
                  className={`rounded-2xl border border-border bg-card/70 p-6 transition-colors duration-300 hover:border-cyan-300/40 md:p-7 ${capability.span}`}
                >
                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    {capability.title}
                  </h3>
                  <ul className="mt-6 space-y-5">
                    {capability.services.map(([name, description]) => (
                      <li key={name} className="border-t border-border/80 pt-4">
                        <h4 className="text-sm font-semibold text-foreground">{name}</h4>
                        <p className="mt-1.5 max-w-prose text-sm leading-6 text-muted-foreground">
                          {description}
                        </p>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </div>
      </AboutMotion>
      <FeaturedWorkspace />
      <Footer />
    </main>
  )
}
