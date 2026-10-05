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

Registration stores a scrypt password hash, normalized email, name, and date of
birth in `auth_users`. Sign-in sessions use random HTTP-only cookies; only their
SHA-256 hashes are stored in `auth_sessions`. Chat remains publicly accessible.
The forgot-password endpoint checks that an account exists before creating and
sending a reset link.
New accounts receive a six-digit email verification code that expires after ten
minutes. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASSWORD` in
the local and production environment settings; SMTP credentials are separate
from the MySQL password.

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

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
