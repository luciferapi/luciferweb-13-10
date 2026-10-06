import nodemailer from "nodemailer"
import type { PayoutDetails } from "@/lib/withdrawal-method-store"

function getTransporter() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env
  const port = Number(process.env.SMTP_PORT ?? "465")
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASSWORD are required to send verification emails.")
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port.")
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })
}

export async function verifySmtpConfiguration(): Promise<void> {
  const transporter = getTransporter()
  try {
    await transporter.verify()
  } finally {
    transporter.close()
  }
}

export async function sendRegistrationOtp(email: string, otp: string): Promise<void> {
  const transporter = getTransporter()
  const { SMTP_USER } = process.env
  await transporter.sendMail({
    from: { name: "Lucifer AI", address: SMTP_USER! },
    to: email,
    subject: "Your Lucifer AI verification code",
    text: `Your verification code is ${otp}. It expires in 5 minutes. If you did not request this, you can ignore this email.`,
    html: `<p>Your Lucifer AI verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p><p>This code expires in 5 minutes. If you did not request this, you can ignore this email.</p>`,
  })
}

export async function sendPasswordResetEmail(email: string, url: string): Promise<void> {
  const transporter = getTransporter()
  const { SMTP_USER } = process.env
  await transporter.sendMail({
    from: { name: "Lucifer AI", address: SMTP_USER! },
    to: email,
    subject: "Reset your Lucifer AI password",
    text: `Use this link to reset your password: ${url}\n\nThis link expires in one hour. If you did not request a reset, you can ignore this email.`,
    html: `<p>We received a request to reset your Lucifer AI password.</p><p><a href="${url}">Reset password</a></p><p>This link expires in one hour. If you did not request a reset, you can ignore this email.</p>`,
  })
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!)
}

export async function sendProjectRequestNotification(input: {
  requestNumber: number
  projectName: string
  description: string
  userEmail: string
  contactEmail: string
  whatsappNumber: string
  telegramId: string
  preferredLanguage: string
  desiredDuration: string
}): Promise<void> {
  const transporter = getTransporter()
  const { SMTP_USER } = process.env
  const recipient = process.env.PROJECT_REQUEST_NOTIFICATION_EMAIL || SMTP_USER
  if (!recipient) throw new Error("Set PROJECT_REQUEST_NOTIFICATION_EMAIL or SMTP_USER for project request notifications.")

  const projectName = escapeHtml(input.projectName)
  const description = escapeHtml(input.description)
  const userEmail = escapeHtml(input.userEmail)
  const additionalDetails = [
    ["Contact Gmail", input.contactEmail],
    ["WhatsApp", input.whatsappNumber],
    ["Telegram ID", input.telegramId],
    ["Preferred language", input.preferredLanguage],
    ["Desired duration", input.desiredDuration],
  ].filter(([, value]) => value)
  const optionalText = additionalDetails.map(([label, value]) => `${label}: ${value}`).join("\n")
  const optionalHtml = additionalDetails
    .map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`)
    .join("")
  await transporter.sendMail({
    from: { name: "Lucifer AI", address: SMTP_USER! },
    to: recipient,
    subject: `New paid project request #${input.requestNumber}`,
    text: `New Project Request\nProject: ${input.projectName}\nUser: ${input.userEmail}\nPayment: ₹1 — Verified (non-refundable request fee)\nRequest ID: #${input.requestNumber}\n${optionalText ? `\n${optionalText}\n` : ""}\nDescription:\n${input.description}`,
    html: `<h1>New Project Request</h1><p><strong>Project:</strong> ${projectName}</p><p><strong>User:</strong> <a href="mailto:${userEmail}">${userEmail}</a></p><p><strong>Payment:</strong> ₹1 — Verified (non-refundable request fee)</p><p><strong>Request ID:</strong> #${input.requestNumber}</p>${optionalHtml}<h2>Description</h2><p style="white-space:pre-wrap">${description}</p>`,
  })
}

export async function sendWithdrawalRequestNotification(input: {
  withdrawalId: string
  userName: string
  userEmail: string | null
  publicUid: string
  amountPaise: number
  payoutDetails: PayoutDetails
}): Promise<void> {
  const transporter = getTransporter()
  const { SMTP_USER } = process.env
  const recipient =
    process.env.WITHDRAWAL_REQUEST_NOTIFICATION_EMAIL ||
    process.env.PROJECT_REQUEST_NOTIFICATION_EMAIL ||
    SMTP_USER
  if (!recipient) {
    throw new Error("Set WITHDRAWAL_REQUEST_NOTIFICATION_EMAIL, PROJECT_REQUEST_NOTIFICATION_EMAIL, or SMTP_USER for withdrawal notifications.")
  }

  const userName = escapeHtml(input.userName)
  const userEmail = input.userEmail ? escapeHtml(input.userEmail) : "Not provided"
  const publicUid = escapeHtml(input.publicUid)
  const withdrawalId = escapeHtml(input.withdrawalId)
  const amount = `₹${(input.amountPaise / 100).toLocaleString("en-IN")}`
  const payoutDestination = input.payoutDetails.method === "upi"
    ? (() => {
        const [accountName, provider] = input.payoutDetails.upiId.split("@")
        return `${accountName.slice(0, 1)}${"*".repeat(Math.min(Math.max(accountName.length - 1, 3), 8))}@${provider}`
      })()
    : `Account ending in ${input.payoutDetails.accountNumber.slice(-4)}`
  const destination = `Payout destination: ${payoutDestination}`

  await transporter.sendMail({
    from: { name: "Lucifer AI", address: SMTP_USER! },
    to: recipient,
    subject: `Wallet withdrawal ${withdrawalId}`,
    text: [
      "New wallet withdrawal request",
      `Withdrawal ID: ${input.withdrawalId}`,
      `Amount: ${amount}`,
      `User: ${input.userName}`,
      `Email: ${input.userEmail || "Not provided"}`,
      `Public UID: ${input.publicUid}`,
      `Payout method: ${input.payoutDetails.method.toUpperCase()}`,
      destination,
      "Status: Pending review",
    ].join("\n"),
    html: `<h1>New wallet withdrawal request</h1><p><strong>Withdrawal ID:</strong> ${withdrawalId}</p><p><strong>Amount:</strong> ${escapeHtml(amount)}</p><p><strong>User:</strong> ${userName}</p><p><strong>Email:</strong> ${userEmail}</p><p><strong>Public UID:</strong> ${publicUid}</p><p><strong>Payout method:</strong> ${input.payoutDetails.method.toUpperCase()}</p><p><strong>Payout destination:</strong> ${escapeHtml(payoutDestination)}</p><p><strong>Status:</strong> Pending review</p>`,
  })
}
