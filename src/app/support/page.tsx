import type { Metadata } from "next"
import { createSocialMetadata } from "@/lib/social-metadata"
import Link from "next/link"
import { ArrowUpRight, Mail } from "lucide-react"
import { Footer } from "@/components/layout/footer"
import { SupportTicketForm } from "@/features/support/components/support-ticket-form"
import { SupportTicketInbox } from "@/features/support/components/support-ticket-inbox"

export const metadata: Metadata = {
  title: "LUCIFER AI Support | Account, Payments and Projects",
  description: "Contact LUCIFER AI support for help with your account, payments, project requests, or API access.",
  ...createSocialMetadata(
    "LUCIFER AI Support | Account, Payments and Projects",
    "Contact LUCIFER AI support for help with your account, payments, project requests, or API access.",
  ),
}

const supportEmail = "lucifer@luciferapi.com"

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-7xl px-5 pb-20 pt-28 sm:px-8 lg:px-12 lg:pt-36">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.56fr)] lg:items-end lg:gap-20">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
              Customer support
            </p>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-6xl">
              How can we help?
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
              Contact us about your account, a payment, a project, or an API. Include enough detail for us to understand the issue.
            </p>
          </div>

          <div className="border-l-2 border-cyan-500/70 py-1 pl-5 sm:pl-6">
            <p className="text-sm font-semibold">Email our support team</p>
            <a
              href={`mailto:${supportEmail}?subject=Customer%20support`}
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cyan-800 underline decoration-cyan-700/40 underline-offset-4 transition-colors hover:text-cyan-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-600 dark:text-cyan-200 dark:hover:text-cyan-100 dark:focus-visible:outline-cyan-200"
            >
              <Mail aria-hidden="true" size={17} />
              {supportEmail}
              <ArrowUpRight aria-hidden="true" size={15} />
            </a>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Please do not email your password or verification codes.
            </p>
          </div>
        </div>

        <section className="mt-20 grid gap-8 border-t border-border pt-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-16" aria-labelledby="submit-ticket-heading">
          <div>
            <h2 id="submit-ticket-heading" className="text-3xl font-semibold tracking-tight">
              Need more help?
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
              Send our team a support ticket. Add an order number if your question is about a purchase.
            </p>
          </div>
          <SupportTicketForm />
        </section>

        <SupportTicketInbox />

        <div className="mt-16 flex flex-col gap-4 border-t border-border pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            For privacy-related requests, see our privacy policy or email the support address above.
          </p>
          <Link
            href="/privacy"
            className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold underline decoration-border underline-offset-4 transition-colors hover:text-cyan-800 dark:hover:text-cyan-200"
          >
            Privacy policy
            <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
        </div>
      </section>
      <Footer />
    </main>
  )
}
