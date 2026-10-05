import Link from "next/link"

const sections = [
  {
    title: "1. Introduction",
    content: (
      <p>
        Welcome to LuciferAPI (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). We respect your privacy and are committed to protecting the personal information you provide when using our website, applications, APIs, and related services (collectively, the &quot;Services&quot;).
      </p>
    ),
  },
  {
    title: "2. Information We Collect",
    content: (
      <>
        <p>Depending on how you use our Services, we may collect:</p>
        <h3>Account information</h3>
        <ul><li>Email address</li><li>Username or display name</li><li>Account credentials</li><li>Account creation and authentication information</li><li>Date of birth provided during account creation</li></ul>
        <h3>Verification information</h3>
        <p>If email verification is used, we may temporarily process verification codes (stored as hashes), verification tokens, expiration times, and email verification status.</p>
        <h3>Technical information</h3>
        <p>We may collect IP address, browser and device information, operating system, request timestamps, and error and security logs, primarily for security, troubleshooting, fraud prevention, and maintaining the Services.</p>
        <h3>Information you provide</h3>
        <p>Information you voluntarily submit may be processed as necessary to provide the requested functionality.</p>
      </>
    ),
  },
  {
    title: "3. How We Use Information",
    content: <><p>We may use collected information to:</p><ul><li>Create and manage user accounts</li><li>Authenticate users and verify email addresses</li><li>Send verification emails, password reset links, and important service communications</li><li>Provide and maintain the Services</li><li>Protect accounts and systems from abuse, fraud, or unauthorized access</li><li>Troubleshoot and improve the reliability and functionality of the Services</li><li>Comply with applicable legal obligations</li></ul><p>We do not use account passwords for purposes unrelated to authentication and security.</p></>,
  },
  {
    title: "4. Password Security",
    content: <p>Passwords are not stored in plain text. Where passwords are used, they are protected using salted password hashing. You should never share your account password or verification codes with other people.</p>,
  },
  {
    title: "5. Email and SMTP Services",
    content: <p>We may use an email service or SMTP provider to send account-related emails, including verification codes and password reset links. The email provider may process information needed to deliver these messages, including your email address. Messages may be sent from <a href="mailto:lucifer@luciferapi.com">lucifer@luciferapi.com</a>.</p>,
  },
  {
    title: "6. Database and Hosting",
    content: <p>We store account and application information using hosting and database infrastructure provided by Hostinger or other providers we may use in the future. Information is shared with these providers only as reasonably necessary to operate and secure the Services.</p>,
  },
  {
    title: "7. Cookies and Similar Technologies",
    content: <><p>We may use cookies, local storage, sessions, or similar technologies to:</p><ul><li>Keep users signed in</li><li>Maintain security</li><li>Remember preferences</li><li>Support essential functionality</li><li>Analyze or improve the Services, where applicable</li></ul><p>You can control cookies through your browser settings, although disabling certain technologies may affect functionality.</p></>,
  },
  {
    title: "8. Data Retention",
    content: <p>We retain personal information only for as long as reasonably necessary to provide the Services, maintain security, resolve disputes, and meet legal obligations. Verification codes and temporary authentication information are deleted or invalidated after they expire or are no longer required.</p>,
  },
  {
    title: "9. Data Security",
    content: <p>We take reasonable technical and organizational measures to protect personal information against unauthorized access, alteration, disclosure, or destruction. However, no online service can guarantee absolute security. Contact us if you believe your account has been compromised.</p>,
  },
  {
    title: "10. Data Sharing",
    content: <><p>We do not sell your personal information. We may share information with service providers that help us operate the Services, such as hosting, database, email delivery, security, and infrastructure providers. We may also disclose information when required by applicable law or to protect our users, Services, or rights.</p></>,
  },
  {
    title: "11. Third-Party Services",
    content: <p>The Services may contain links to or integrations with third-party services. Those services have their own privacy policies and terms. We are not responsible for the privacy practices of services we do not control.</p>,
  },
  {
    title: "12. Your Rights",
    content: <><p>Depending on your location and applicable law, you may have the right to request access to, correction of, or deletion of information associated with your account; withdraw consent where processing is based on consent; request information about processing; or object to certain processing activities. We may need to verify your identity before completing a request.</p><p>For privacy requests, contact <a href="mailto:lucifer@luciferapi.com">lucifer@luciferapi.com</a>.</p></>,
  },
  {
    title: "13. Children’s Privacy",
    content: <p>Users must be at least 15 years old to create an account. We do not knowingly collect account information from people under 15. If you believe someone under 15 has provided us with personal information, contact us so we can review and take appropriate action.</p>,
  },
  {
    title: "14. International Data Transfers",
    content: <p>Depending on the location of our users and service providers, personal information may be processed or stored in countries other than your own. Where required by applicable law, we will take appropriate measures for such transfers.</p>,
  },
  {
    title: "15. Changes to This Privacy Policy",
    content: <p>We may update this Privacy Policy from time to time. When changes are made, we will update the effective date. Significant changes may also be communicated through the Services where appropriate.</p>,
  },
  {
    title: "16. Contact Us",
    content: <p>LuciferAPI · <a href="mailto:lucifer@luciferapi.com">lucifer@luciferapi.com</a> · <a href="https://luciferapi.com">luciferapi.com</a></p>,
  },
]

export const metadata = {
  title: "Privacy Policy | LuciferAPI",
  description: "Learn how LuciferAPI collects, uses, and protects personal information.",
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background px-5 pb-20 pt-36 text-foreground sm:px-8">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-cyan-700 hover:underline dark:text-cyan-300">← Home</Link>
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.25em] text-cyan-700 dark:text-cyan-300">LuciferAPI · Legal</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Privacy Policy</h1>
        <p className="mt-4 text-sm text-muted-foreground">Effective Date: October 4, 2026 · Website: luciferapi.com · Contact: <a className="underline" href="mailto:lucifer@luciferapi.com">lucifer@luciferapi.com</a></p>
        <div className="mt-10 space-y-8">
          {sections.map(({ title, content }) => (
            <section key={title} className="space-y-3 border-t border-border pt-6 text-sm leading-7 text-muted-foreground [&_h3]:pt-2 [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_a]:text-cyan-700 [&_a]:underline dark:[&_a]:text-cyan-300">
              <h2 className="text-lg font-bold text-foreground">{title}</h2>
              {content}
            </section>
          ))}
        </div>
        <p className="mt-10 border-t border-border pt-5 text-xs text-muted-foreground">Last Updated: October 4, 2026</p>
      </article>
    </main>
  )
}
