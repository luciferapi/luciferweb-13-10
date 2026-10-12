import { OWNER_EMAIL } from "@/features/auth/server/owner-email"
import {
  getSmtpSender,
  sendSmtpMessage,
  verifySmtpConfiguration,
} from "@/lib/smtp-server"
import type { PayoutDetails } from "@/features/wallet/server/withdrawal-method-store"

export { verifySmtpConfiguration }

export async function sendSmtpTestEmail(): Promise<void> {
  const SMTP_USER = getSmtpSender()

  await sendSmtpMessage({
    from: { name: "Lucifer AI", address: SMTP_USER },
    to: SMTP_USER,
    subject: "Lucifer AI SMTP test",
    text: "This is a test email confirming that Hostinger SMTP is configured correctly.",
    html: "<p>This is a test email confirming that Hostinger SMTP is configured correctly.</p>",
  })
}

export async function sendBroadcastEmails(input: {
  recipients: string[]
  subject: string
  message: string
}): Promise<{ accepted: number; failed: number }> {
  const SMTP_USER = getSmtpSender()

  let accepted = 0
  let failed = 0
  for (let offset = 0; offset < input.recipients.length; offset += 25) {
    const batch = input.recipients.slice(offset, offset + 25)
    try {
      const result = await sendSmtpMessage({
        from: { name: "Lucifer AI", address: SMTP_USER },
        bcc: batch,
        subject: input.subject,
        text: `${input.message}\n\nThanks,\nLucifer AI`,
      })
      accepted += result.accepted.length
      failed += batch.length - result.accepted.length
    } catch (error) {
      failed += batch.length
      console.error("A broadcast email batch failed.", error instanceof Error ? error.message : "Unknown SMTP error.")
    }
  }
  return { accepted, failed }
}

export async function sendRegistrationOtp(email: string, otp: string, name: string): Promise<void> {
  await sendOtpEmail({
    kind: "registration",
    email,
    otp,
    name,
    subject: "Your Lucifer AI verification OTP",
    expiresIn: "10 minutes",
  })
}

export async function sendOwnerLoginOtp(email: string, otp: string, name: string): Promise<void> {
  await sendOtpEmail({
    kind: "owner sign-in",
    email,
    otp,
    name,
    subject: "Your Lucifer AI owner sign-in code",
    expiresIn: "5 minutes",
  })
}

export async function sendStaffLoginOtp(email: string, otp: string, name: string): Promise<void> {
  await sendOtpEmail({
    kind: "staff sign-in",
    email,
    otp,
    name,
    subject: "Your Lucifer AI staff sign-in code",
    expiresIn: "5 minutes",
  })
}

async function sendOtpEmail(input: {
  kind: "registration" | "owner sign-in" | "staff sign-in"
  email: string
  otp: string
  name: string
  subject: string
  expiresIn: string
}) {
  const SMTP_USER = getSmtpSender()
  const safeName = escapeHtml(input.name)

  const result = await sendSmtpMessage({
    from: { name: "Lucifer AI", address: SMTP_USER },
    to: input.email,
    subject: input.subject,
    text: `Hi, ${input.name}\n\nYour One-Time Password (OTP) is:\n\n${input.otp}\n\nThis OTP is valid for ${input.expiresIn}. Please do not share this code with anyone.\n\nIf you did not request this OTP, you can safely ignore this email.\n\nThanks,\nluciferapi`,
    html: `<p>Hi, ${safeName}</p><p>Your One-Time Password (OTP) is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px"><strong>${input.otp}</strong></p><p>This OTP is valid for <strong>${input.expiresIn}</strong>. Please do not share this code with anyone.</p><p>If you did not request this OTP, you can safely ignore this email.</p><p>Thanks,<br><strong>luciferapi</strong></p>`,
  })

  const recipientWasAccepted = result.accepted.some((recipient: string | { address: string }) => {
    const address = typeof recipient === "string" ? recipient : recipient.address
    return address.trim().toLowerCase() === input.email.trim().toLowerCase()
  })
  if (!recipientWasAccepted) {
    throw new Error("The SMTP server did not accept the OTP recipient.")
  }

  console.info("OTP email accepted by the SMTP relay.", {
    kind: input.kind,
    messageId: result.messageId,
  })
}

type TeamEmailInput = {
  to: string
  subject: string
  text: string
  html: string
  replyTo?: string
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType: string
  }>
}

async function sendTeamEmail(input: TeamEmailInput): Promise<void> {
  const SMTP_USER = getSmtpSender()
  await sendSmtpMessage({
    from: { name: "Lucifer AI", address: SMTP_USER },
    to: input.to,
    replyTo: input.replyTo,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  })
}

export async function sendPasswordResetEmail(email: string, url: string): Promise<void> {
  const SMTP_USER = getSmtpSender()
  const safeUrl = escapeHtml(url)
  await sendSmtpMessage({
    from: { name: "Lucifer AI", address: SMTP_USER },
    to: email,
    subject: "Reset your Lucifer AI password",
    text: `Use this link to reset your password: ${url}\n\nThis link expires in one hour. If you did not request a reset, you can ignore this email.`,
    html: `<p>We received a request to reset your Lucifer AI password.</p><p><a href="${safeUrl}">Reset password</a></p><p>This link expires in one hour. If you did not request a reset, you can ignore this email.</p>`,
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
  const recipient = process.env.PROJECT_REQUEST_NOTIFICATION_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL
  if (!recipient) throw new Error("Set PROJECT_REQUEST_NOTIFICATION_EMAIL for project request notifications.")

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
  await sendTeamEmail({
    to: recipient,
    subject: `New paid project request #${input.requestNumber}`,
    text: `New Project Request\nProject: ${input.projectName}\nUser: ${input.userEmail}\nPayment: ₹1 — Verified (non-refundable request fee)\nRequest ID: #${input.requestNumber}\n${optionalText ? `\n${optionalText}\n` : ""}\nDescription:\n${input.description}`,
    html: `<h1>New Project Request</h1><p><strong>Project:</strong> ${projectName}</p><p><strong>User:</strong> <a href="mailto:${userEmail}">${userEmail}</a></p><p><strong>Payment:</strong> ₹1 — Verified (non-refundable request fee)</p><p><strong>Request ID:</strong> #${input.requestNumber}</p>${optionalHtml}<h2>Description</h2><p style="white-space:pre-wrap">${description}</p>`,
  })
}

export async function sendSupportTicketNotification(input: {
  ticketId: string
  issueType: "account" | "payment" | "project" | "api" | "other"
  orderId: string
  description: string
  userName: string
  userEmail: string
  attachment?: {
    filename: string
    content: Buffer
    contentType: string
  }
}): Promise<void> {
  const recipient = process.env.SUPPORT_TICKET_NOTIFICATION_EMAIL
  if (!recipient) {
    throw new Error("Set SUPPORT_TICKET_NOTIFICATION_EMAIL for support ticket notifications.")
  }

  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!)
  const issueLabel = ({
    account: "Account access",
    payment: "Payment or wallet",
    project: "Project purchase",
    api: "API issue",
    other: "Other",
  } as const)[input.issueType]
  const details = [
    `Ticket: ${input.ticketId}`,
    `Issue type: ${issueLabel}`,
    `Customer: ${input.userName} <${input.userEmail}>`,
    `Order number: ${input.orderId || "Not provided"}`,
    "",
    "Problem description:",
    input.description,
  ].join("\n")

  await sendTeamEmail({
    to: recipient,
    replyTo: input.userEmail,
    subject: `Support ticket ${input.ticketId}: ${issueLabel}`,
    text: details,
    html: `<h1>Support ticket ${escapeHtml(input.ticketId)}</h1><p><strong>Issue type:</strong> ${escapeHtml(issueLabel)}</p><p><strong>Customer:</strong> ${escapeHtml(input.userName)} &lt;${escapeHtml(input.userEmail)}&gt;</p><p><strong>Order number:</strong> ${escapeHtml(input.orderId || "Not provided")}</p><h2>Problem description</h2><p style="white-space:pre-wrap">${escapeHtml(input.description)}</p>`,
    attachments: input.attachment ? [{
      filename: input.attachment.filename,
      content: input.attachment.content,
      contentType: input.attachment.contentType,
    }] : [],
  })
}

export async function sendSupportTicketReplyNotification(input: {
  ticketId: string
  issueType: "account" | "payment" | "project" | "api" | "other"
  userName: string
  userEmail: string
  staffName: string
  response: string
}): Promise<void> {
  const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://luciferapi.com")
  if (siteUrl.protocol !== "https:" && siteUrl.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTP or HTTPS.")
  }
  const supportUrl = new URL("/support", siteUrl).toString()
  const sender = getSmtpSender()
  const userName = escapeHtml(input.userName)
  const staffName = escapeHtml(input.staffName)
  const ticketId = escapeHtml(input.ticketId)
  const response = escapeHtml(input.response)
  const subject = `Update to your support ticket ${input.ticketId}`
  await sendSmtpMessage({
    from: { name: "Lucifer AI Support", address: sender },
    to: input.userEmail,
    replyTo: sender,
    subject,
    text: `Hi ${input.userName},\n\n${input.staffName} replied to your ${input.issueType} support ticket ${input.ticketId}:\n\n${input.response}\n\nYou can view the full conversation and reply at ${supportUrl}.\n\nLucifer AI Support`,
    html: `<p>Hi ${userName},</p><p>${staffName} replied to your <strong>${escapeHtml(input.issueType)}</strong> support ticket <strong>${ticketId}</strong>:</p><blockquote style="white-space:pre-wrap;border-left:3px solid #0891b2;padding:8px 16px;margin:16px 0">${response}</blockquote><p><a href="${escapeHtml(supportUrl)}">View the conversation and reply</a></p><p>Lucifer AI Support</p>`,
  })
}

export async function sendSupportTicketFollowupNotification(input: {
  ticketId: string
  issueType: "account" | "payment" | "project" | "api" | "other"
  userName: string
  userEmail: string
  message: string
}): Promise<void> {
  const recipient = process.env.SUPPORT_TICKET_NOTIFICATION_EMAIL
  if (!recipient) throw new Error("Set SUPPORT_TICKET_NOTIFICATION_EMAIL for support ticket notifications.")
  const userName = escapeHtml(input.userName)
  const userEmail = escapeHtml(input.userEmail)
  const ticketId = escapeHtml(input.ticketId)
  const message = escapeHtml(input.message)
  await sendTeamEmail({
    to: recipient,
    replyTo: input.userEmail,
    subject: `Customer reply: support ticket ${input.ticketId}`,
    text: [
      `Customer reply to ticket ${input.ticketId}`,
      `Issue type: ${input.issueType}`,
      `Customer: ${input.userName} <${input.userEmail}>`,
      "",
      input.message,
    ].join("\n"),
    html: `<h1>Customer replied to support ticket ${ticketId}</h1><p><strong>Issue type:</strong> ${escapeHtml(input.issueType)}</p><p><strong>Customer:</strong> ${userName} &lt;${userEmail}&gt;</p><p style="white-space:pre-wrap">${message}</p>`,
  })
}

export async function sendSupportTicketEscalationNotification(input: {
  ticketId: string
  issueType: "account" | "payment" | "project" | "api" | "other"
  userName: string
  userEmail: string
  staffName: string
  note: string
}): Promise<void> {
  const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://luciferapi.com")
  if (siteUrl.protocol !== "https:" && siteUrl.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTP or HTTPS.")
  }
  const inboxUrl = new URL("/owner/escalations", siteUrl).toString()
  const ticketId = escapeHtml(input.ticketId)
  const staffName = escapeHtml(input.staffName)
  const userName = escapeHtml(input.userName)
  const userEmail = escapeHtml(input.userEmail)
  const note = escapeHtml(input.note)
  await sendTeamEmail({
    to: OWNER_EMAIL,
    subject: `Support escalation: ${input.ticketId}`,
    text: [
      `Customer support forwarded ticket ${input.ticketId} to the owner.`,
      `Issue type: ${input.issueType}`,
      `Forwarded by: ${input.staffName}`,
      `Customer: ${input.userName} <${input.userEmail}>`,
      "",
      "Internal handoff note:",
      input.note,
      "",
      `Open the owner escalation inbox: ${inboxUrl}`,
    ].join("\n"),
    html: `<h1>Support ticket forwarded to the owner</h1><p><strong>Ticket:</strong> ${ticketId}</p><p><strong>Issue type:</strong> ${escapeHtml(input.issueType)}</p><p><strong>Forwarded by:</strong> ${staffName}</p><p><strong>Customer:</strong> ${userName} &lt;${userEmail}&gt;</p><h2>Internal handoff note</h2><p style="white-space:pre-wrap">${note}</p><p><a href="${escapeHtml(inboxUrl)}">Open the owner escalation inbox</a></p>`,
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
  const recipient = process.env.WITHDRAWAL_REQUEST_NOTIFICATION_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL
  if (!recipient) {
    throw new Error("Set WITHDRAWAL_REQUEST_NOTIFICATION_EMAIL for withdrawal notifications.")
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

  await sendTeamEmail({
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
