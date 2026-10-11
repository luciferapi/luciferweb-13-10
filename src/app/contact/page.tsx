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
    <main className="min-h-screen overflow-hidden bg-[#09090b] text-white">
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-6 lg:px-8">
        <ContactEntrance>
          <div className="space-y-10">
            <header className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-200">Work with LUCIFER AI</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-white sm:text-5xl">Start a project request</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                Share what you want to build and how to reach you. Submission requires a verified account and a non-refundable ₹1 request fee.
              </p>
            </header>
            <nav aria-label="Page sections" className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
              <a
                href="#project-request"
                className="inline-flex items-center rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-200 transition-colors hover:border-cyan-300 hover:text-cyan-100"
              >
                Project request
              </a>
              <a
                href="/contact/process"
                className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.02] px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
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
