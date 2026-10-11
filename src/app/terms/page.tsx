import Link from "next/link"
import { createSocialMetadata } from "@/lib/social-metadata"

const sections = [
  {
    title: "1. Agreement to these terms",
    content: (
      <p>
        These Terms and Conditions (&quot;Terms&quot;) apply when you visit luciferapi.com or use LUCIFER AI accounts, AI chat, project services, paid APIs, wallet features, referrals, or support. By accessing or using a feature, you agree to the Terms that apply to it. If you do not agree, do not use that feature. These Terms do not limit rights that cannot be excluded under applicable law.
      </p>
    ),
  },
  {
    title: "2. Eligibility and accounts",
    content: (
      <>
        <p>
          Accounts are intended for people aged 15 or older. You are responsible for providing accurate information, keeping your sign-in credentials and verification codes secure, and activity through your account. Notify us promptly if you believe your account has been accessed without permission.
        </p>
        <p>
          We may restrict or suspend access when reasonably necessary to protect users or the service, address suspected abuse, enforce these Terms, or comply with law. Where appropriate, we will provide information about the restriction and how to contact support.
        </p>
      </>
    ),
  },
  {
    title: "3. Acceptable use",
    content: (
      <>
        <p>You agree not to use the service to:</p>
        <ul>
          <li>Break the law, infringe another person&apos;s rights, or submit content you are not authorized to provide.</li>
          <li>Attempt unauthorized access, disrupt the service, bypass security or usage limits, or interfere with other users.</li>
          <li>Upload malicious code, abuse APIs, scrape or overload the service, or use it to send spam or commit fraud.</li>
          <li>Request or use generated content to facilitate harmful, deceptive, or unlawful conduct.</li>
        </ul>
        <p>
          You remain responsible for the content and instructions you submit and for checking that your use of the service is lawful.
        </p>
      </>
    ),
  },
  {
    title: "4. AI features",
    content: (
      <p>
        AI responses can be incomplete, inaccurate, outdated, or unsuitable for your circumstances. They are provided for general informational and creative assistance, not as professional, legal, medical, financial, or other expert advice. Review outputs before relying on, publishing, or using them. Do not submit information you are not authorized to share with the AI providers involved in producing a response.
      </p>
    ),
  },
  {
    title: "5. Project requests and services",
    content: (
      <>
        <p>
          Submitting a project request does not guarantee that it will be accepted, started, or completed. Project details, scope, deliverables, timing, and any additional charges should be confirmed with us separately before work beyond the request submission begins.
        </p>
        <p>
          The project request form identifies its ₹1 submission fee as non-refundable, including if a request is declined or cannot be completed. This fee is separate from any price agreed for project work.
        </p>
      </>
    ),
  },
  {
    title: "6. Purchases, payments, and wallet",
    content: (
      <>
        <p>
          Prices, currency, and applicable purchase details are shown during checkout. Payments and wallet deposits are processed through Razorpay. A purchase or deposit is subject to payment verification; an order is not confirmed merely because checkout was started.
        </p>
        <p>
          Wallet balances are available for eligible project and paid API purchases. Cash withdrawals are not currently available. The specific purchase description and terms presented at checkout apply to that transaction. If you have a payment issue, contact <a href="mailto:lucifer@luciferapi.com">lucifer@luciferapi.com</a> with the order reference.
        </p>
      </>
    ),
  },
  {
    title: "7. Paid APIs and purchased files",
    content: (
      <p>
        Paid API access and project files are provided according to the description shown for the relevant offering. Keep API keys, download links, and access credentials secure. Do not resell, share, or use access in a way that bypasses the applicable purchase or usage limits. Availability may depend on the service or third-party systems. Any license or usage rights specific to a purchased project or API are those expressly stated for that offering or separately agreed in writing.
      </p>
    ),
  },
  {
    title: "8. Referrals and rewards",
    content: (
      <p>
        Referral features are subject to the program rules displayed on the site. Referrals must be genuine and may be reviewed. A referral status or displayed reward amount is not a guarantee of payment or credit; rewards are subject to program eligibility and manual review. We may reject, suspend, or adjust referrals or rewards where we reasonably identify abuse, duplicate or misleading activity, or ineligibility.
      </p>
    ),
  },
  {
    title: "9. Your content",
    content: (
      <p>
        You keep any rights you hold in content you submit. You authorize us and the providers we use to process that content only as reasonably necessary to operate the feature you requested, including storing project or support submissions and transmitting AI prompts to providers to generate responses. You confirm that you have the rights needed to submit the content and grant this limited permission. Do not submit confidential or third-party material unless you are authorized to do so.
      </p>
    ),
  },
  {
    title: "10. Our service and intellectual property",
    content: (
      <p>
        The site, software, branding, and materials we provide are owned by us or our licensors and are protected by applicable intellectual property laws. These Terms give you permission to use the service for its intended purposes; they do not transfer ownership of the service or its materials. Rights to particular purchased deliverables are governed by the purchase description or a separate written agreement.
      </p>
    ),
  },
  {
    title: "11. Third-party services",
    content: (
      <p>
        The service may connect to providers such as AI, hosting, identity, storage, or payment services. Those providers may have separate terms and privacy policies. We do not control third-party services, and their availability or actions are governed by their own terms.
      </p>
    ),
  },
  {
    title: "12. Availability and liability",
    content: (
      <p>
        We work to keep the service available and secure but do not guarantee uninterrupted or error-free operation. To the extent permitted by law, the service is provided without warranties beyond those that cannot legally be excluded. Nothing in these Terms excludes liability or consumer rights that applicable law does not allow us to exclude or limit.
      </p>
    ),
  },
  {
    title: "13. Changes to the service or Terms",
    content: (
      <p>
        We may change or discontinue features and may update these Terms as the service or legal requirements change. We will update the date below when we publish a new version. Continued use after an update means you accept the revised Terms to the extent permitted by law. If you do not agree to an update, stop using the affected feature.
      </p>
    ),
  },
  {
    title: "14. Contact",
    content: (
      <p>
        Questions about these Terms can be sent to <a href="mailto:lucifer@luciferapi.com">lucifer@luciferapi.com</a>. See the <Link href="/privacy">Privacy Policy</Link> for information about personal data.
      </p>
    ),
  },
]

export const metadata = {
  title: "Terms and Conditions | LUCIFER AI",
  description: "Review the terms governing LUCIFER AI accounts, AI tools, project services, purchases, wallet features, and APIs.",
  ...createSocialMetadata(
    "Terms and Conditions | LUCIFER AI",
    "Review the terms governing LUCIFER AI accounts, AI tools, project services, purchases, wallet features, and APIs.",
  ),
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-5 pb-20 pt-36 text-foreground sm:px-8">
      <article className="mx-auto max-w-3xl">
          <Link href="/" className="text-sm text-cyan-700 hover:underline dark:text-cyan-300">← Home</Link>
          <p className="mt-8 font-mono text-xs uppercase tracking-[0.25em] text-cyan-700 dark:text-cyan-300">LUCIFER AI · Legal</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Terms and Conditions</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Effective date: October 10, 2026 · Website: luciferapi.com ·{" "}
            <Link className="underline" href="/privacy">Privacy Policy</Link>
          </p>
          <div className="mt-10 space-y-8">
            {sections.map(({ title, content }) => (
              <section key={title} className="space-y-3 border-t border-border pt-6 text-sm leading-7 text-muted-foreground [&_h3]:pt-2 [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_a]:text-cyan-700 [&_a]:underline dark:[&_a]:text-cyan-300">
                <h2 className="text-lg font-bold text-foreground">{title}</h2>
                {content}
              </section>
            ))}
          </div>
          <p className="mt-10 border-t border-border pt-5 text-xs text-muted-foreground">Last updated: October 10, 2026</p>
      </article>
    </main>
  )
}
