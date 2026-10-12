import "server-only"
import nodemailer from "nodemailer"

export type SmtpConfiguration = {
  host: string
  port: number
  user: string
  password: string
}

export type SmtpTransporter = ReturnType<typeof nodemailer.createTransport>

const DEFAULT_SMTP_HOST = "smtp.hostinger.com"

let cachedConfiguration: SmtpConfiguration | null = null
let cachedTransporter: SmtpTransporter | null = null

export function resolveSmtpConfiguration(): SmtpConfiguration {
  const user = process.env.SMTP_USER?.trim()
  const password = process.env.SMTP_PASSWORD
  const host = process.env.SMTP_HOST?.trim() || DEFAULT_SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? "465")

  if (!user || !password) {
    throw new Error("SMTP_USER and SMTP_PASSWORD are required to send email.")
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port.")
  }

  return { host, port, user, password }
}

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASSWORD)
}

export function getSmtpSender(): string {
  return resolveSmtpConfiguration().user
}

function sameSmtpConfiguration(
  left: SmtpConfiguration | null,
  right: SmtpConfiguration,
): boolean {
  return left?.host === right.host &&
    left?.port === right.port &&
    left?.user === right.user &&
    left?.password === right.password
}

export function createSmtpTransporter(configuration: SmtpConfiguration): SmtpTransporter {
  return nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.port === 465,
    auth: { user: configuration.user, pass: configuration.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })
}

export function getSmtpTransporter(): SmtpTransporter {
  const configuration = resolveSmtpConfiguration()

  if (cachedTransporter && sameSmtpConfiguration(cachedConfiguration, configuration)) {
    return cachedTransporter
  }

  // Do not close the previous transporter here. A concurrent request may still
  // be using it, and closing it can terminate its writable stream mid-message.
  // Nodemailer transporters are safe to reuse across concurrent sends; the old
  // instance will be released by the runtime once no request references it.
  cachedConfiguration = configuration
  cachedTransporter = createSmtpTransporter(configuration)
  return cachedTransporter
}

export type SmtpSendResult = {
  accepted: Array<string | { address: string }>
  messageId?: string
}

export async function sendSmtpMessage(
  message: Record<string, unknown>,
): Promise<SmtpSendResult> {
  const result = await getSmtpTransporter().sendMail(message as never)
  return result as SmtpSendResult
}

export async function verifySmtpConfiguration(): Promise<void> {
  await getSmtpTransporter().verify()
}
