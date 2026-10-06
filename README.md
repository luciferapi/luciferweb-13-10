# lucifer-website-development

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_VTKjW1WIvUc6UEnyaj9hsjUvb5Fy)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Hostinger MySQL

Project data is stored in the Hostinger MySQL database. Configure either
`DATABASE_URL` or the individual `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
and `DB_NAME` variables in `.env.local` and in production hosting settings. Keep
all credentials private. For local development, use Hostinger's remote database
host and allow only the development machine's public IP in remote-access settings.
When the app runs on the same Hostinger account, use the host specified for that
website/database in hPanel.

Before starting the app against a new database, import the current project catalog:

```bash
npm run db:migrate
```

The migration creates the `projects` table, imports the contents of
`data/projects.json`, verifies the imported rows, and removes that seed file only
after the import succeeds. Do not run it until the database settings point at the
intended database.

You can optionally use Cloudflare R2 for project images, demo videos, and source ZIPs
instead of local disk. Set `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`,
`CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET`, and
`CLOUDFLARE_R2_ENDPOINT` in `.env.local` and production hosting settings. Set
`CLOUDFLARE_R2_PUBLIC_URL` to the bucket's public custom domain or enabled `r2.dev`
URL for images and videos. Create a second bucket with public access disabled and set
its name as `CLOUDFLARE_R2_PRIVATE_BUCKET`; source ZIPs are stored there and only
returned through the verified purchase download flow. Give the R2 access key
permission to read and write both buckets. When R2 is not configured, uploads
continue to use local disk.

Create the authentication tables once before using account registration or
sign-in:

```bash
npm run db:migrate-auth
```

Registration stores a scrypt password hash, normalized email, name, date of
birth, and a unique public UID in `auth_users`. The profile also supports
optional Telegram and X usernames. Re-run `npm run db:migrate-auth` to apply
authentication schema updates and assign public UIDs to existing accounts
before deploying code that displays them. Sign-in sessions use random
HTTP-only cookies; only their SHA-256 hashes are stored in `auth_sessions`.
Display name and date of birth can each be changed once from Settings. A
confirmation is shown before either change, and customer support must handle
later corrections. Chat remains publicly accessible.
The forgot-password endpoint checks that an account exists before creating and
sending a reset link.
New accounts receive a six-digit email verification code that expires after ten
minutes. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASSWORD` in
the local and production environment settings; SMTP credentials are separate
from the MySQL password.

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
identity against the account, and creates its own session cookie. Authentication
tables are created by `npm run db:migrate-auth`.

### Paid project requests

Apply the project-request schema after migrating authentication:

```bash
npm run db:migrate-project-requests
```

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

### Wallet deposits and withdrawals

After creating the authentication tables, create the saved payout method table
and wallet deposit and withdrawal request tables before enabling those Wallet
features:

```bash
npm run db:migrate-withdrawal-methods
npm run db:migrate-wallet
```

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
