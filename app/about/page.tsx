import { Footer } from "@/components/footer"
import { FeaturedWorkspace } from "@/components/featured-workspace"

const services = [
  ["Websites", "Modern, responsive websites for personal and professional projects."],
  ["Web Applications", "Custom applications with practical interfaces and backend functionality."],
  ["API Development", "Create and integrate APIs for connecting applications and services."],
  ["UI Development", "Responsive interfaces for web applications and dashboards."],
  ["UI/UX Design", "Clean layouts and user-focused digital experiences."],
  ["Automated Bots", "Custom automation and bot solutions for suitable workflows."],
  ["Custom Automation", "Automate repetitive tasks and connect different systems."],
  ["Mini Projects", "Small custom projects for learning, testing, and practical use."],
]

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-6xl px-6 pb-28 pt-40">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-fuchsia-400">{"// about me"}</p>
        <h1 className="mt-6 max-w-4xl text-[clamp(2.5rem,8vw,6rem)] font-black uppercase tracking-[-0.06em] text-foreground md:text-8xl">
          BUILDING DIGITAL <span className="text-cyan-300">EXPERIENCES</span>
        </h1>
        <p className="mt-8 max-w-2xl text-lg leading-8 text-muted-foreground">
          I&apos;m a student passionate about coding, AI, technology, cryptocurrency, and blockchain. I enjoy learning new technologies, solving problems, and building practical projects. My goal is to strengthen my technical skills and pursue a successful career in the technology field.
        </p>
        <div className="mt-20">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-300">{"// what I do"}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {services.map(([title, description]) => (
              <article key={title} className="rounded-2xl border border-border bg-card/80 p-5 transition hover:-translate-y-1 hover:border-cyan-300/40">
                <h2 className="font-bold text-foreground">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <FeaturedWorkspace />
      <Footer />
    </main>
  )
}
