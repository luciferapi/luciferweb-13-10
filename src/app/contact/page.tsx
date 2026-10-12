import type { Metadata } from "next"
import { createSocialMetadata } from "@/lib/social-metadata"
import { Footer } from "@/components/layout/footer"
import { ProjectRequestForm } from "@/features/projects/components/project-request-form"
import { ContactEntrance } from "@/features/projects/components/contact-entrance"

export const metadata: Metadata = {
  title: "Contact LUCIFER AI | Start a Website or App Project",
  description: "Tell LUCIFER AI about your website, web application, API, or automation project and discuss the right next steps.",
  ...createSocialMetadata(
    "Contact LUCIFER AI | Start a Website or App Project",
    "Tell LUCIFER AI about your website, web application, API, or automation project and discuss the right next steps.",
  ),
}

export default function ContactPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-6 lg:px-8">
        <ContactEntrance>
          <div className="space-y-10">
            <header className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-lime dark:text-lime">Work with LUCIFER AI</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-foreground sm:text-5xl">Start a project request</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Share what you want to build and how to reach you. Submission requires a verified account and a non-refundable ₹1 request fee.
              </p>
            </header>
            <nav aria-label="Page sections" className="flex flex-wrap gap-2 border-b border-border pb-4">
              <a
                href="#project-request"
                className="inline-flex items-center rounded-full border border-lime/40 bg-lime/10 px-3 py-2 text-sm font-medium text-lime transition-colors hover:border-lime hover:text-lime dark:border-lime/40 dark:bg-lime/10 dark:text-lime dark:hover:border-lime dark:hover:text-lime"
              >
                Project request
              </a>
              <a
                href="/contact/process"
                className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-lime/40 hover:text-lime dark:bg-white/[0.02] dark:hover:border-lime/40 dark:hover:text-lime"
              >
                Process
              </a>
            </nav>

            <div id="project-request" data-contact-form className="min-w-0 lg:pt-2">
              <ProjectRequestForm />
            </div>
          </div>
        </ContactEntrance>
      </section>
      <Footer />
    </main>
  )
}
