import Link from "next/link"
import { createSocialMetadata } from "@/lib/social-metadata"

const sections = [
  {
    title: "1. About this policy",
    content: (
      <p>
        This policy describes how LUCIFER AI handles information when you visit luciferapi.com or use its accounts, AI features, project and API services, payments, wallet, referrals, and support. It reflects the features and integrations currently present on the site. We may update it when those practices change.
      </p>
    ),
  },
  {
    title: "2. Information we collect",
    content: (
      <>
        <p>What we receive depends on the features you use. It can include:</p>
        <ul>
          <li><strong>Account and sign-in information:</strong> name, email address, password hash, public account ID, sign-in provider identifiers, and verification or session records. Google sign-in provides us a name and verified email address; X and Telegram sign-in provide an account identifier and name. Optional profile fields include date of birth, Telegram username, and X username.</li>
          <li><strong>Project requests:</strong> project name and description, preferred language, requested timing, and the contact details you choose to provide, such as an email address, WhatsApp number, or Telegram username or ID. Requests are associated with your account and payment/order records.</li>
          <li><strong>Support:</strong> issue category, optional order reference, message, and any attachment you choose to submit. The current form accepts JPG, PNG, WebP, and PDF files up to 5 MB.</li>
          <li><strong>AI and API features:</strong> text prompts and conversation context you send to AI features. The API Explorer also makes a GET request to the endpoint selected from its catalog; it does not currently submit a custom form body.</li>
          <li><strong>Payments and wallet:</strong> order and payment references, amounts, currency, status, and payment method or provider details returned during payment verification. If an account has a previously saved withdrawal method, it may include the account holder’s name and a UPI ID or bank account number and IFSC code.</li>
          <li><strong>Technical and security information:</strong> IP/network address, browser or device information, request timing, and security or error diagnostics may be processed by the app or its hosting and security services. For account creation, the app uses a SHA-256 hash of the signup IP address, with an app-specific prefix, for duplicate-signup prevention rather than saving the raw address in the signup-IP field.</li>
        </ul>
        <p>
          We store passwords as hashes rather than as readable passwords. We do not ask you to enter payment card details into our own account, project, or support forms. Avoid including sensitive information in chat, project briefs, or support messages unless it is needed for your request.
        </p>
      </>
    ),
  },
  {
    title: "3. How we use information",
    content: (
      <>
        <p>We use information to operate the features you request, including to:</p>
        <ul>
          <li>Create and secure accounts; verify email addresses; manage sign-in, password resets, and profile settings.</li>
          <li>Send account, support, project, and other service messages to account email addresses. A restricted owner-only tool can also send email broadcasts to all or selected account email addresses.</li>
          <li>Respond to AI prompts; provide project, API, and purchased services; and administer orders, payments, wallet activity, and referrals.</li>
          <li>Receive and respond to support requests, including sending relevant request details to our support team.</li>
          <li>Protect the site from abuse, enforce rate limits, diagnose errors, and maintain the service.</li>
        </ul>
        <p>We do not sell personal information and do not currently use advertising cookies or marketing pixels.</p>
      </>
    ),
  },
  {
    title: "4. AI features",
    content: (
      <>
        <p>
          The AI Chat feature sends the text in your prompt and the conversation context you submit to the server-configured Ollama endpoint and model. The chat request can also include your account display name in its assistant context. The chat feature saves conversation history and your selected Ollama model in your browser’s local storage; the current chat route does not save chat transcripts in the site’s MySQL application database.
        </p>
        <p>
          The optional homepage assistant is separate. When you submit a question to it, our server sends that prompt to the configured Ollama model to generate a reply. Do not submit information you are not comfortable sharing with this AI service.
        </p>
      </>
    ),
  },
  {
    title: "5. Payments and wallet information",
    content: (
      <>
        <p>
          Razorpay provides the payment checkout and processes payments. We create and verify orders through Razorpay and keep the resulting payment/order references and transaction details needed to administer purchases and wallet deposits. Order metadata sent to Razorpay can include the internal account identifier and, depending on the transaction, a project or API identifier or project-request reference. Payment forms are provided by Razorpay; our application records do not store full card numbers. Razorpay processes payment information under its own terms and privacy practices.
        </p>
        <p>
          The site can look up a bank branch from an IFSC code through Razorpay’s IFSC service when that feature is used. Cash withdrawals and new payout-method saves are currently unavailable. If an account has a payout method saved from an earlier version, the saved data can include the account holder’s name and either a UPI ID or bank account number and IFSC code; the app encrypts that information before storing it in its database.
        </p>
      </>
    ),
  },
  {
    title: "6. Services and providers",
    content: (
      <>
        <p>Depending on the feature, information may be processed by these services:</p>
        <ul>
          <li><strong>Hostinger:</strong> the site’s MySQL database and, by default, the SMTP email relay used for verification, sign-in, password-reset, support, project-request, and owner-initiated broadcast messages. The SMTP relay may be changed through site configuration.</li>
          <li><strong>Vercel:</strong> site hosting and related runtime services, Vercel-hosted assets, and optional Vercel Analytics.</li>
          <li><strong>Ollama:</strong> the homepage assistant and AI Chat send prompts to the server-configured Ollama endpoint and model.</li>
          <li><strong>Razorpay:</strong> payment checkout, order/payment verification, and the IFSC bank-branch lookup.</li>
          <li><strong>Cloudflare R2:</strong> storage and delivery of site-managed project media and downloadable source files.</li>
          <li><strong>Google, X, and Telegram:</strong> identity services used when you choose an enabled social sign-in option. The Telegram sign-in widget loads a script from Telegram when you start that option.</li>
        </ul>
        <p>
          API Explorer entries are configured dynamically. When you test one, our server makes a GET request to the endpoint URL configured for that entry. The specific endpoint operator therefore depends on the catalog item you select. External links, including the site’s Instagram link, take you to the destination service if you open them; that service then handles your visit under its own policies.
        </p>
        <p>
          These providers may process information under their own terms and privacy practices. Their services and processing are not controlled by this policy.
        </p>
      </>
    ),
  },
  {
    title: "7. Cookies, browser storage, and analytics",
    content: (
      <>
        <p>
          The site uses essential cookies for account sessions and sign-in security. These include <code>lucifer_session</code> and <code>lucifer_owner_session</code>, and short-lived Google/X OAuth or Telegram sign-in state cookies. During social sign-up, temporary cookies may also hold the date of birth, privacy-choice flag, or referral code needed to complete that sign-up. The OAuth and Telegram sign-in state cookies are configured for up to 10 minutes.
        </p>
        <p>
          The <code>lucifer_cookie_consent</code> cookie records the essential/analytics choice, policy version, and time of the choice for up to 180 days. The <code>sidebar_state</code> cookie remembers the sidebar setting for up to seven days. Browser local storage remembers the selected theme, AI chat history, and selected model. Session storage can hold a project-request draft and a temporary source-download token. These storage items support the features you use; clearing them may remove saved information or interrupt a feature.
        </p>
        <p>
          Vercel Analytics is optional and is loaded only after you allow analytics in the privacy-preference panel. If enabled, it receives page views for selected public routes with query strings and project identifiers removed, plus generic conversion events after a project request, source-code purchase, or API Explorer purchase is verified. Those conversion events do not include form text, project names or codes, account or payment identifiers, or prices. Wallet deposits are not tracked as conversions. A Global Privacy Control signal keeps optional analytics disabled. You can change your choice at any time through Cookie settings; withdrawing analytics consent stops the active script after the page reloads.
        </p>
        <p>
          We do not currently use advertising cookies or marketing pixels. Razorpay checkout and the Telegram sign-in widget load only when you choose the related feature.
        </p>
      </>
    ),
  },
  {
    title: "8. Sharing information",
    content: (
      <p>
        We share information with the providers listed above when needed to operate a feature. Project-request details and support-ticket information may also be sent to our team by email through the configured SMTP relay; a support attachment is included with that support notification email rather than saved in the site’s support-ticket database record. We may disclose information when necessary to respond to a valid legal request or protect users, the service, or our rights. We do not sell personal information or share it for third-party advertising.
      </p>
    ),
  },
  {
    title: "9. Retention and security",
    content: (
      <p>
        We retain account, project, support, payment, and security records for as long as they are needed to operate the service, manage transactions and support, prevent abuse, and maintain business records. The site does not publish a fixed retention period for each record type, and retention can also depend on the provider involved. We use measures visible in the implementation, such as password hashing, protected session cookies, and encryption of any stored payout-method details. No website or storage system can be guaranteed completely secure.
      </p>
    ),
  },
  {
    title: "10. Your choices and privacy requests",
    content: (
      <p>
        You can update certain profile information in Settings, clear browser-stored data through your browser, clear chat history in the chat feature, and reject or withdraw optional analytics through Cookie settings. To ask about access to, correction of, or deletion of account information, email <a href="mailto:lucifer@luciferapi.com">lucifer@luciferapi.com</a>, preferably from your account email. We may ask you to verify that you control the account. Some transaction, security, or support records may need to be retained after a request.
      </p>
    ),
  },
  {
    title: "11. Date of birth and age information",
    content: (
      <p>
        Social account sign-up asks for a date of birth and checks it against the site’s 15+ account eligibility threshold. Date of birth can also be added or changed in profile settings. Where provided, it is stored with the account profile. The site’s current email-and-password registration flow does not submit a date of birth as part of its registration request.
      </p>
    ),
  },
  {
    title: "12. Changes and contact",
    content: (
      <>
        <p>
          We may revise this policy when the site or its data practices change. For questions about the policy or information handled by the site, contact <a href="mailto:lucifer@luciferapi.com">lucifer@luciferapi.com</a>.
        </p>
        <p>LUCIFER AI · <a href="https://luciferapi.com">luciferapi.com</a></p>
      </>
    ),
  },
]

const description = "Learn what information LUCIFER AI handles through accounts, AI chat, project requests, payments, support, cookies, and its third-party services."

export const metadata = {
  title: "Privacy Policy | LUCIFER AI",
  description,
  ...createSocialMetadata("Privacy Policy | LUCIFER AI", description),
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background px-5 pb-20 pt-36 text-foreground sm:px-8">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-cyan-700 hover:underline dark:text-cyan-300">← Home</Link>
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.25em] text-cyan-700 dark:text-cyan-300">LUCIFER AI · Legal</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Privacy Policy</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Effective date: October 13, 2026 · Website: luciferapi.com · Contact:{" "}
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
        <p className="mt-10 border-t border-border pt-5 text-xs text-muted-foreground">Last updated: October 13, 2026</p>
      </article>
    </main>
  )
}
