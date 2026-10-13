import Link from "next/link"
import { createSocialMetadata } from "@/lib/social-metadata"

const sections = [
  {
    title: "1. About this policy",
    content: (
      <p>
        This Privacy Policy explains how LUCIFER AI (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) handles information when you visit luciferapi.com or use its accounts, AI chat, project and API services, payments, referrals, or support features. It describes current practices and may be updated when those practices change.
      </p>
    ),
  },
  {
    title: "2. Information you provide",
    content: (
      <>
        <p>Depending on the features you use, information may include:</p>
        <ul>
          <li>Account name, email address, password credentials, date of birth, public account ID, and sign-in or verification details.</li>
          <li>Optional profile details such as Telegram or X usernames, and referral information.</li>
          <li>Messages and prompts you submit to AI chat, plus project briefs, API requests, uploaded files, and support messages.</li>
          <li>Payment and purchase references, amounts, and status needed to process orders, wallet deposits, and purchased services.</li>
        </ul>
        <p>
          Do not include passwords, payment card details, government identifiers, or other sensitive information in chat, project briefs, or support messages unless a feature specifically requires it.
        </p>
      </>
    ),
  },
  {
    title: "3. Information collected through use",
    content: (
      <>
        <p>
          The service and its infrastructure may receive technical information such as IP address, browser and device details, request times, and security or error logs. During account creation, we create a SHA-256 hash of the signup IP address, with an application-specific prefix, for abuse prevention rather than saving that address in the signup-IP field.
        </p>
        <p>
          We use an HTTP-only session cookie to keep you signed in. The site also uses browser storage for functional purposes: AI chat history and selected model in local storage, and some project-request drafts or download tokens in session storage. Browser storage remains on your device and can be cleared through your browser settings; clearing it may remove saved drafts or chat history.
        </p>
      </>
    ),
  },
  {
    title: "4. How we use information",
    content: (
      <>
        <p>We use information as needed to:</p>
        <ul>
          <li>Create and secure accounts, authenticate users, and send verification or password-reset emails.</li>
          <li>Respond to prompts, process project and API requests, provide purchased services, and manage referrals and wallet transactions.</li>
          <li>Provide customer support, prevent abuse or fraud, troubleshoot issues, and maintain and improve the service.</li>
          <li>Meet legal obligations and protect the service, users, and our rights.</li>
        </ul>
        <p>We do not sell personal information.</p>
      </>
    ),
  },
  {
    title: "5. AI chat",
    content: (
      <p>
        When you use AI chat, your prompt and the conversation context you submit are sent from our server to OpenRouter to generate a response, using the model selected in the service. OpenRouter may route the request to the relevant model provider. That provider&apos;s handling of the request is subject to its own terms and privacy practices. Chat history is also saved in your browser&apos;s local storage for the chat feature. Do not submit information you are not comfortable sending to these providers.
      </p>
    ),
  },
  {
    title: "6. Payments",
    content: (
      <p>
        Payments are handled by Razorpay. We use payment and order details returned by Razorpay to confirm and administer purchases or deposits. Payment card or bank credentials are handled by the payment provider, not stored by us as full payment credentials. Razorpay&apos;s processing is governed by its own privacy policy and terms.
      </p>
    ),
  },
  {
    title: "7. Service providers",
    content: (
      <>
        <p>
          We use providers to operate the service and process information for the purposes described in this policy. These include Hostinger for database services, Cloudflare R2 for file storage, Vercel for hosting and service analytics, OpenRouter and its model providers for AI chat, Razorpay for payments, and an SMTP email provider for service messages. Providers may process information on our behalf or under their own terms when you use an integrated service.
        </p>
        <p>
          Sign-in options may also use Google, X, or Telegram. If you choose one, that provider processes information under its own privacy terms. The Telegram sign-in option loads a Telegram widget from Telegram.
        </p>
      </>
    ),
  },
  {
    title: "8. Cookies, storage, and analytics",
    content: (
      <>
        <p>
          Essential cookies support account sessions and sign-in security. These include lucifer_session and lucifer_owner_session for authentication, plus short-lived OAuth and Telegram state cookies when you start one of those sign-in flows. A preference cookie named lucifer_cookie_consent records that essential cookies are active, whether you allowed optional analytics, the consent version, and when you made the choice. It is stored for up to 180 days so we can remember your choice. Essential cookies cannot be switched off in the preference panel.
        </p>
        <p>
          The functional sidebar_state cookie remembers whether a sidebar is expanded for up to seven days. Local storage also remembers your selected theme and chat history. Session storage holds project-request drafts and temporary download tokens. This first-party storage supports features you use and is not used for advertising. Clearing browser storage may remove saved items or interrupt a feature.
        </p>
        <p>
          Vercel Analytics is optional. It is not loaded unless you explicitly allow analytics in the consent panel. When enabled, we measure views of selected public pages using normalized paths without query strings or project identifiers, and record generic conversion events after a project request, source-code purchase, or API Explorer purchase is verified. We do not send form contents, project names or codes, account or payment identifiers, or prices in these events; wallet deposits are not tracked as conversions. You can reject optional analytics or change your choice at any time using Cookie settings. If you withdraw analytics consent after it has been enabled, the page reloads to stop the active analytics script. Your choice is stored in the preference cookie for up to 180 days.
        </p>
        <p>
          We do not currently use advertising cookies or marketing pixels. Payment checkout and the Telegram sign-in widget are loaded only after you choose to use those features. Those providers may process information under their own privacy terms.
        </p>
      </>
    ),
  },
  {
    title: "9. Retention and security",
    content: (
      <p>
        We retain information for as long as reasonably needed to provide the service, maintain account and transaction records, address support issues, prevent abuse, and meet legal obligations. Retention periods can differ by information type and provider. We use reasonable safeguards, including protected session cookies and password hashing, but no internet transmission or storage system can be guaranteed completely secure.
      </p>
    ),
  },
  {
    title: "10. Sharing and legal requests",
    content: (
      <p>
        We share information with the service providers described above when needed to deliver a feature. We may also disclose information when required by law or legal process, or when reasonably necessary to protect users, the service, or our rights. We do not sell personal information or share it for third-party advertising.
      </p>
    ),
  },
  {
    title: "11. Your choices and requests",
    content: (
      <p>
        You can update certain account details in your account settings and clear locally saved data through your browser. You may also request access to, correction of, or deletion of personal information, subject to applicable law and records we may need to retain. Contact <a href="mailto:lucifer@luciferapi.com">lucifer@luciferapi.com</a> from your account email where possible. We may ask you to verify your identity before acting on a request.
      </p>
    ),
  },
  {
    title: "12. Age and international processing",
    content: (
      <>
        <p>
          Accounts are intended for people aged 15 or older. We do not knowingly collect account information from anyone under 15. If you believe a person under 15 has provided account information, contact us so we can review it.
        </p>
        <p>
          Our providers may process information in countries other than the country where you live. Where applicable law requires safeguards for an international transfer, we will take steps required by that law.
        </p>
      </>
    ),
  },
  {
    title: "13. Changes and contact",
    content: (
      <>
        <p>
          We may revise this policy as the service or its data practices change. The effective date below shows when this version was published. For questions or privacy requests, contact us at <a href="mailto:lucifer@luciferapi.com">lucifer@luciferapi.com</a>.
        </p>
        <p>LUCIFER AI · <a href="https://luciferapi.com">luciferapi.com</a></p>
      </>
    ),
  },
]

export const metadata = {
  title: "Privacy Policy | LUCIFER AI",
  description: "Read how LUCIFER AI collects, uses, protects, and retains account, chat, payment, support, and website analytics data.",
  ...createSocialMetadata(
    "Privacy Policy | LUCIFER AI",
    "Read how LUCIFER AI collects, uses, protects, and retains account, chat, payment, support, and website analytics data.",
  ),
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background px-5 pb-20 pt-36 text-foreground sm:px-8">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-cyan-700 hover:underline dark:text-cyan-300">← Home</Link>
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.25em] text-cyan-700 dark:text-cyan-300">LUCIFER AI · Legal</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Privacy Policy</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Effective date: October 25, 2026 · Website: luciferapi.com · Contact:{" "}
          <a className="underline" href="mailto:lucifer@luciferapi.com">lucifer@luciferapi.com</a>
        </p>
          <div className="mt-10 space-y-8">
          {sections.map(({ title, content }) => (
            <section key={title} className="space-y-3 border-t border-border pt-6 text-sm leading-7 text-muted-foreground [&_h3]:pt-2 [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_a]:text-cyan-700 [&_a]:underline dark:[&_a]:text-cyan-300">
              <h2 className="text-lg font-bold text-foreground">{title}</h2>
              {content}
            </section>
          ))}
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            Also see our <Link className="text-cyan-700 underline dark:text-cyan-300" href="/terms">Terms and Conditions</Link>.
          </p>
          <p className="mt-10 border-t border-border pt-5 text-xs text-muted-foreground">Last updated: October 25, 2026</p>
        </article>
    </main>
  )
}
