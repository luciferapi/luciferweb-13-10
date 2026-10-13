import type { Metadata } from "next"
import Link from "next/link"
import { createSocialMetadata } from "@/lib/social-metadata"

const sections = [
  {
    title: "1. About these Terms and the services",
    content: (
      <>
        <p>
          These Terms describe use of luciferapi.com and LUCIFER AI features, including the AI chat, custom website and application work, APIs and automations, academic project support, project/source-code listings, paid API Explorer testing, wallet deposits, referrals, and support. The “Watch Ads &amp; Tasks” and “Tasks” pages are informational guides; they do not operate an earning marketplace or promise earnings from third-party platforms.
        </p>
        <p>
          A project request is only a way to contact us. Any custom-work scope, deliverables, timing, price, maintenance, hosting, and intellectual-property rights must be confirmed separately in the relevant written quote or agreement. These Terms do not replace those project-specific details.
        </p>
        <p>
          By creating an account, placing an order, or using a feature, you are asked to follow these Terms. They do not remove any rights that applicable law does not allow a service provider to exclude.
        </p>
      </>
    ),
  },
  {
    title: "2. Eligibility and accounts",
    content: (
      <>
        <p>
          The site currently describes accounts as intended for people aged 15 or older. Some account-creation routes ask for date of birth; email-and-password registration does not. The site therefore does not verify age consistently across all registration routes.
        </p>
        <p>
          If you are below the age at which you may independently enter the relevant agreement where you live, involve a parent or legal guardian and obtain any consent required by law before creating an account, submitting personal information, or making a purchase. This notice is not a parental-consent process. Provide accurate account information, keep your sign-in credentials and verification codes secure, and tell us promptly if you believe your account has been accessed without permission.
        </p>
      </>
    ),
  },
  {
    title: "3. Project requests and custom work",
    content: (
      <>
        <p>
          The project-request form requires a verified account, project name and description, preferred language, requested timing, at least one contact method, and acceptance of the ₹1 request fee described below. A submitted request is not an offer we have accepted, a promise that work will start, or a guarantee of completion.
        </p>
        <p>
          The form currently says our team will contact you within 12 hours after a request is submitted. That is a follow-up message about the request, not a project start date, delivery deadline, or guarantee that the request will be accepted. Work beyond reviewing a request begins only after the parties separately confirm its scope, deliverables, schedule, price, and any other material terms in writing.
        </p>
      </>
    ),
  },
  {
    title: "4. Academic project support",
    content: (
      <p>
        Academic project support is offered for learning and project-building purposes. You are responsible for checking your school, college, or other institution’s rules, and for deciding whether and how the work may be used or disclosed. We do not promise a particular grade, mark, approval, research result, or other academic outcome.
      </p>
    ),
  },
  {
    title: "5. Project listings, downloads, and usage rights",
    content: (
      <>
        <p>
          A project listing describes the relevant item and shows its price when a price is available. For a paid source-code listing, the site issues a download after the payment is verified and the purchase is associated with your account. Keep download links and account credentials secure.
        </p>
        <p>
          A payment alone does not promise exclusive ownership, a transfer of all intellectual-property rights, ongoing support, updates, or maintenance. The license or ownership rights for a particular downloaded project or custom deliverable are only those expressly stated in its listing or in a separate written agreement. Check those details before purchase or ask us for written clarification.
        </p>
      </>
    ),
  },
  {
    title: "6. Paid API Explorer access",
    content: (
      <p>
        The current API checkout charges for access to test the selected endpoint through the in-site API Explorer. The checkout does not describe a recurring subscription. A purchase is not a sale of the underlying API, ownership of an endpoint, or a promise that an upstream endpoint will remain available or produce a particular result. Some endpoints may be operated by third parties or may be accessible separately from the Explorer; follow any terms and usage limits stated for the endpoint and do not assume the purchase grants exclusive access.
      </p>
    ),
  },
  {
    title: "7. AI features",
    content: (
      <p>
        AI-generated answers may be incomplete, inaccurate, outdated, or unsuitable for your situation. They are general informational or creative assistance, not legal, medical, financial, or other professional advice. Check important outputs independently before acting on, publishing, or relying on them. Do not submit information that you are not authorized to share with the providers used to generate a response. The Privacy Policy explains the related personal-data handling.
      </p>
    ),
  },
  {
    title: "8. Payments, cancellations, and refunds",
    content: (
      <>
        <p>
          Prices and currency are shown with the relevant offering or during checkout. Razorpay processes the site’s online checkouts. An order or purchase is treated as confirmed only after the payment is verified by the site. Closing or failing a checkout may update the order status but does not itself reverse a payment that has already been captured. If you were charged but the order, access, or download is missing, contact <a href="mailto:lucifer@luciferapi.com">lucifer@luciferapi.com</a> with the order or payment reference.
        </p>
        <p>
          The project-request form expressly describes its ₹1 submission fee as non-refundable, including if the request is declined or cannot be completed. This fee is separate from the price of any later project work and remains subject to rights that cannot lawfully be excluded.
        </p>
        <p>
          The site currently publishes no general cancellation or refund rule for other project/source-code purchases or paid API Explorer access, and no general wallet-deposit refund rule has been verified. Do not assume that those purchases or deposits are refundable or non-refundable based on the ₹1 request-fee rule. Ask us for the transaction-specific terms before paying if this point matters to you. Nothing in these Terms limits a right or remedy that applicable law requires.
        </p>
      </>
    ),
  },
  {
    title: "9. Wallet deposits and current feature limits",
    content: (
      <>
        <p>
          A signed-in account can currently deposit whole-rupee amounts from ₹50 to ₹1,000 through Razorpay and view wallet balance and transaction history. The wallet page says balances may be used for project and paid API purchases, but the current project and API checkout flows do not provide a wallet-payment option. Cash withdrawals are marked as unavailable. This is a mismatch between the wallet page’s description and the available checkout functions.
        </p>
        <p>
          At the effective date, do not deposit expecting to spend the balance in checkout or withdraw it as cash. The site has not published a general wallet-redemption or deposit-refund policy. Contact support before depositing if you need a specific use or refund arrangement. This section does not promise future wallet functionality.
        </p>
      </>
    ),
  },
  {
    title: "10. Referrals and rewards",
    content: (
      <p>
        The referral dashboard displays the current program reward amounts and conditions, which may include purchase thresholds, expiry dates, and referral limits. Referrals and rewards are subject to manual review and are not automatically paid or credited. A displayed amount is not a guarantee of payment or credit. Do not create duplicate or misleading referrals, spam people, or abuse the program. We may reject or adjust a referral or reward where we reasonably identify abuse or ineligibility, subject to applicable law.
      </p>
    ),
  },
  {
    title: "11. Your content",
    content: (
      <p>
        You retain rights you hold in material you submit. You allow us and the providers needed for the selected feature to process it only as reasonably necessary to provide that feature, such as responding to an AI prompt or handling a project or support request. You confirm that you are authorized to submit the material and grant this limited permission. Do not submit confidential or third-party material unless you have permission to do so. More information about data handling is in the <Link href="/privacy">Privacy Policy</Link>.
      </p>
    ),
  },
  {
    title: "12. Third-party services and API responses",
    content: (
      <p>
        Features may rely on third-party payment, identity, AI, hosting, storage, email, or API services. For example, Razorpay processes payments and an API Explorer request may be sent to the endpoint displayed for that test. Those providers may apply their own terms and privacy policies. We do not control their independent services, and we cannot promise their availability, security, or results. The Privacy Policy identifies the third-party services found in the site’s current implementation.
      </p>
    ),
  },
  {
    title: "13. Acceptable use",
    content: (
      <>
        <p>You must not use the site or its features to:</p>
        <ul>
          <li>Break the law, infringe another person’s rights, or submit material you are not authorized to provide.</li>
          <li>Attempt unauthorized access, bypass security or usage limits, disrupt the site, or interfere with another user.</li>
          <li>Upload malicious code, abuse an API, overload or scrape the service, send spam, or commit fraud.</li>
          <li>Use generated content or project deliverables to facilitate harmful, deceptive, or unlawful conduct.</li>
        </ul>
        <p>You remain responsible for your instructions, submitted content, and use of outputs.</p>
      </>
    ),
  },
  {
    title: "14. Site materials and intellectual property",
    content: (
      <p>
        The site, software, branding, and materials we provide belong to LUCIFER AI or their respective licensors, unless a listing or written agreement says otherwise. These Terms do not transfer ownership of the site or its materials. Rights in a paid project, source file, or custom deliverable are governed by the specific listing or separate written agreement described above.
      </p>
    ),
  },
  {
    title: "15. Availability, changes, and account restrictions",
    content: (
      <>
        <p>
          Features may change, be interrupted, or be discontinued. We do not promise uninterrupted or error-free operation. We may restrict or suspend an account when reasonably needed to address suspected abuse, protect the service or users, enforce these Terms, or comply with law. Where appropriate, we will provide information about the restriction and a way to contact support.
        </p>
        <p>
          We may revise these Terms and will update the effective date on this page. If a change requires fresh agreement under applicable law, continued use alone will not replace that requirement.
        </p>
      </>
    ),
  },
  {
    title: "16. Legal rights and contact",
    content: (
      <>
        <p>
          Nothing in these Terms excludes or limits a right, remedy, or liability that applicable law does not allow to be excluded or limited. No governing law, court location, or dispute process is specified here because the service provider’s legal identity and place of business have not been verified for this draft.
        </p>
        <p>
          For questions about these Terms, a purchase, or a project request, contact <a href="mailto:lucifer@luciferapi.com">lucifer@luciferapi.com</a>. See the <Link href="/privacy">Privacy Policy</Link> for information about personal data.
        </p>
      </>
    ),
  },
]

export const metadata: Metadata = {
  title: "Terms and Conditions | LUCIFER AI",
  description: "Terms for LUCIFER AI accounts, custom digital projects, AI tools, API Explorer access, purchases, wallet deposits, and referrals.",
  ...createSocialMetadata(
    "Terms and Conditions | LUCIFER AI",
    "Terms for LUCIFER AI accounts, custom digital projects, AI tools, API Explorer access, purchases, wallet deposits, and referrals.",
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
          Effective date: October 13, 2026 · Website: luciferapi.com ·{" "}
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
        <p className="mt-10 border-t border-border pt-5 text-xs text-muted-foreground">Last updated: October 13, 2026</p>
      </article>
    </main>
  )
}
