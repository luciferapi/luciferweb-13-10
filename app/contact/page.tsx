import { Footer } from "@/components/footer"
import { ProjectRequestForm } from "@/components/project-request-form"
import { ContactEntrance } from "@/components/contact/contact-entrance"

const services = [
  "Websites and web applications",
  "UI/UX and dashboard design",
  "API development and integration",
  "Automation and custom bots",
  "Mini projects and custom builds",
]

export default function ContactPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#09090b] text-white">
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-6 lg:px-8">
        <ContactEntrance>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:grid-rows-[auto_1fr] lg:gap-x-14 lg:gap-y-10">
            <div data-contact-intro className="flex flex-col">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-200">
                Contact Lucifer AI
              </p>
              <h1 className="mt-6 max-w-5xl text-[clamp(3rem,5vw,4.7rem)] font-semibold leading-[1.05] tracking-[-0.065em]">
                <span className="sr-only">What are you building?</span>
                <span aria-hidden="true" className="block overflow-hidden pb-1">
                  <span data-contact-word className="mr-[0.22em] inline-block">What</span>
                  <span data-contact-word className="inline-block">are</span>
                </span>
                <span aria-hidden="true" className="block overflow-hidden pb-1">
                  <span data-contact-word className="mr-[0.22em] inline-block">you</span>
                  <span data-contact-word className="inline-block">building?</span>
                </span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-white/65">
                Tell me what you&apos;re imagining. We&apos;ll shape the first idea into something you can use.
              </p>

              <a
                href="mailto:lucifer@luciferapi.com"
                className="mt-4 inline-flex min-h-11 w-fit items-center text-sm font-semibold text-cyan-200 underline decoration-cyan-200/40 underline-offset-4 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
              >
                Email lucifer@luciferapi.com
              </a>
            </div>

            <div data-contact-form className="order-2 min-w-0 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-2">
              <ProjectRequestForm />
            </div>

            <aside className="order-3 lg:col-start-1 lg:row-start-2">
              <h2 className="text-sm font-semibold text-white/90">What I can help with</h2>
              <ul data-contact-services className="mt-4 divide-y divide-white/10 border-y border-white/10">
                {services.map((service) => (
                  <li data-contact-service key={service} className="py-3 text-sm leading-6 text-white/70">
                    {service}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </ContactEntrance>
      </section>
      <Footer />
    </main>
  )
}
