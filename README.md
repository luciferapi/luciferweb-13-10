# lucifer-website-development

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_VTKjW1WIvUc6UEnyaj9hsjUvb5Fy)

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

## Source layout

- `src/app` contains routes, layouts, and API handlers. Route pages connect URLs to
  feature-owned screens; for example, sign-in UI and behavior live in
  `src/features/auth`.
- `src/features` groups feature-specific components and server-side logic.
- `src/components` and `src/hooks` contain shared UI and hooks.
- `src/lib` contains shared integrations and low-level helpers; `src/lib/smtp-server.ts`
  owns the SMTP transport, while `src/features/notifications/server/email.ts`
  owns application email workflows and templates.
- `src/features/auth/server` owns authentication rules and user/session persistence;
  `src/features/storage/server/r2-storage.ts` is the shared Cloudflare R2 boundary.
- `public` contains static web assets; `storage/project-catalog` contains local project media and source bundles.
- `supabase` contains database configuration, migrations, and Edge Functions.
- `docs` contains project documentation and archived design references.

## Authentication, email, and file storage

- **Email delivery:** Registration verification codes, password-reset links, and
  owner/staff sign-in codes are sent through the shared Hostinger SMTP transport.
  Route handlers validate and orchestrate requests; email templates and delivery
  live in `src/features/notifications/server/email.ts`. Staff and owner accounts
  use emailed one-time codes only; password, Google/X, and Telegram login paths
  cannot create privileged sessions.
- **User records:** Supabase Auth owns account credentials. The application profile
  and public UID are stored in `public.auth_users`; provider links and hashed app
  sessions are stored in `public.auth_identities` and `public.auth_sessions`.
  Staff role and module access are stored in `public.owner_admins`. Feature data
  such as projects, wallet activity, referrals, and support tickets remains in
  their corresponding Supabase tables.
- **Media files:** Image and demo-video bytes are uploaded to the public Cloudflare
  R2 media bucket through `src/features/storage/server/r2-storage.ts`. Supabase
  stores application records and references, not the media bytes. Source ZIPs and
  maintenance settings use the separate private R2 bucket; protected download
  routes return source files only after purchase verification.

## Supabase backend

The Next.js app stores authentication records, sessions, projects, purchases,
wallet activity, payout methods, referrals, and project requests in Supabase
Postgres through server-side Supabase clients. It has no MySQL runtime fallback.
Copy `.env.example` to `.env.local`
and configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
and the server-only `SUPABASE_SECRET_KEY` (or
`SUPABASE_SERVICE_ROLE_KEY`). Never expose the server key through a
`NEXT_PUBLIC_` variable.

App-managed email uses Hostinger SMTP (`smtp.hostinger.com`, port `465`) by
default. Configure `SMTP_USER` and `SMTP_PASSWORD` with the Hostinger mailbox
credentials. `SMTP_HOST` and `SMTP_PORT` can override the defaults if needed.
To send a delivery test, make a same-origin `POST` request to
`/api/owner/email-test` while signed in to the owner account with an email
verification code. It sends a fixed test message to `SMTP_USER`; it does not
accept arbitrary recipients.

Apply the database schema to the intended Supabase project with the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The migration enables row-level security and grants application table access
only to the server-side service role. Keep that key private and configure it in
the production hosting environment as well as local development. These schema
migrations create the Supabase tables but do not transfer existing MySQL
accounts, payment history, or project records; plan and verify any legacy-data
import separately before switching a live deployment.

Owner uploads for project images, demo videos, homepage banner images, maintenance images,
and source ZIPs are stored in Cloudflare R2. Homepage banner text, link paths, enabled state,
and display order remain in Supabase. Banner image URLs are stored as private
R2 metadata keyed by banner ID, and uploaded image bytes are stored in the public R2 bucket.
Set `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`,
`CLOUDFLARE_R2_SECRET_ACCESS_KEY`, and `CLOUDFLARE_R2_BUCKET` in `.env.local` and
production hosting settings. The endpoint is derived from the account ID; set
`CLOUDFLARE_R2_ENDPOINT` only when using a custom S3-compatible endpoint. Use a
public bucket hostname such as `https://<bucket>.<account-id>.r2.cloudflarestorage.com`,
a custom public domain, or an enabled `r2.dev` URL for images, videos, and banners.
If the value is set to the account-level R2 endpoint, the app normalizes it to the
bucket-specific public hostname automatically. Create a second bucket with public access
disabled and set its name as `CLOUDFLARE_R2_PRIVATE_BUCKET`; source ZIPs are stored there
and only returned through the verified purchase download flow. Maintenance settings are also
stored in this private bucket; maintenance images remain in the public media bucket. Give
the R2 access key permission to read and write both buckets. New owner uploads fail with a setup error rather
than silently falling back to local disk if R2 is unavailable. Legacy files already on local
disk can still be read until they are migrated. The variable names are listed in `.env.example`.

Supabase Auth manages account credentials. The application profile stores the
normalized email, name, and a unique public UID in Supabase; date of birth is
optional and can be added later in Settings. The profile also supports optional
Telegram and X usernames.
Sign-in sessions use random HTTP-only cookies; only their SHA-256 hashes are
stored in Supabase.
New signups are limited to one account per public IP across email, Google, X,
and Telegram. Only a SHA-256 hash of the signup IP is stored. The deployment
proxy must set a trusted `CF-Connecting-IP`, `X-Real-IP`, or `X-Forwarded-For`
header and overwrite or sanitize client-supplied values; signup fails closed
when no valid client IP is provided. Existing accounts have no historical IP
record, so the restriction applies to accounts created after deployment.
Display name and date of birth can each be changed once from Settings. A
confirmation is shown before either change, and customer support must handle
later corrections. Chat remains publicly accessible.
The forgot-password endpoint checks that an account exists before creating
and sending a reset link. Owner and staff sign-in codes are generated and
verified by the app, sent through Hostinger SMTP, and require the server-only
Supabase key. Staff OTP issuance and verification are restricted to active staff
assignments and checked again in the database. Owner/staff access requires an
email-OTP-authenticated session. No Supabase Auth SMTP configuration is required.

Set `PAYOUT_DATA_ENCRYPTION_KEY` to a strong, persistent server-only secret so
saved payout details can be encrypted at rest. Registration, owner sign-in,
support tickets, project requests, withdrawal notifications, and
password-reset messages use Hostinger SMTP. Set `SUPPORT_TICKET_NOTIFICATION_EMAIL`,
`ADMIN_NOTIFICATION_EMAIL`, `PROJECT_REQUEST_NOTIFICATION_EMAIL`, and
`WITHDRAWAL_REQUEST_NOTIFICATION_EMAIL` as needed. Project and withdrawal
alerts use their specific recipient when set, otherwise they fall back to
`ADMIN_NOTIFICATION_EMAIL`. Never commit SMTP, encryption, or provider secrets.

### Google sign-in

Google OAuth is implemented as a server-side authorization-code flow. To enable it:

1. In Google Cloud Console, select or create a project and configure the OAuth
   consent screen with the app name, support email, and the scopes `openid`,
   `email`, and `profile`. Add test users while the consent screen is in Testing,
   or publish the consent screen before making sign-in generally available.
2. Create an OAuth client ID with application type **Web application**.
3. Add these authorized redirect URIs to that client:
   - `http://localhost:3000/api/auth/oauth/callback/google` for local development.
   - `https://your-production-host/api/auth/oauth/callback/google` for production,
     replacing the host with the exact public origin used by the app.
4. Set `AUTH_BASE_URL` to the matching origin, without a trailing slash, and set
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local` for development
   and in the production hosting provider's secret environment settings. Never
   commit real credentials or put the client secret in a `NEXT_PUBLIC_` variable.
5. Restart/redeploy the app. The Google option is enabled when both Google
   credentials are present. New Google accounts still require the user to enter
   a date of birth and accept the Privacy Policy before OAuth begins.

The callback URI must match exactly between Google Cloud Console and
`AUTH_BASE_URL`. The app uses the provider's verified email, stores the Google
identity against the account, and creates its own session cookie. Identity and
session records are stored in Supabase.

### Paid project requests

The Contact page requires a signed-in account (new accounts must verify their
email), a project name and description, and explicit acceptance of the
non-refundable ₹1 request fee, which helps discourage spam and prioritize
genuine project requests. Configure the server-side Razorpay credentials
and `NEXT_PUBLIC_RAZORPAY_KEY_ID` for checkout. Verified requests are saved only
after Razorpay signature and order verification. The owner notification goes
to `PROJECT_REQUEST_NOTIFICATION_EMAIL`, or to `SMTP_USER` when no separate
recipient is configured. Keep these settings private and configure them in
production hosting as well as local development. Requesters may also provide
optional contact email, WhatsApp number, Telegram ID, preferred language, and
desired duration. The confirmation states that the team will respond within
12 hours.
Use Razorpay test credentials in local development and live credentials only in
production. Configure `NEXT_PUBLIC_RAZORPAY_KEY_ID` for the browser checkout and
`RAZORPAY_KEY_ID` plus `RAZORPAY_KEY_SECRET` for server-side order creation and
verification. Never expose or commit the secret key.

### Wallet deposits and withdrawals

Deposits use Razorpay Checkout and are credited only after the payment
signature, Razorpay order, and captured payment are verified server-side.
Verified payment method, provider status, references, contact details, fees,
taxes, and available payment-method details are saved with the deposit and
shown in its transaction history. Full card numbers are never stored. Configure
`RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in local and production server
environment settings. Deposits are limited to whole-rupee amounts from ₹50 to
₹1,000. Each deposit and withdrawal has a unique 16-character alphanumeric ID:
deposit IDs start with `DEP`, and withdrawal IDs start with `WIT`.

Withdrawal requests require a payout method saved in Settings. Requests are
limited to ₹50-₹1,500 each, up to four requests per user per day (India
Standard Time), and cannot exceed the available wallet balance. New requests
are emailed to `WITHDRAWAL_REQUEST_NOTIFICATION_EMAIL`, falling back to
`PROJECT_REQUEST_NOTIFICATION_EMAIL` and then `SMTP_USER`. The notification
contains the request amount and a masked payout destination; full payout
details remain encrypted at rest. Configure `PAYOUT_DATA_ENCRYPTION_KEY` for
encrypted payout storage and SMTP settings for email delivery. If email
delivery fails, the request remains saved and the requester is shown its
reference ID so they can contact support.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
