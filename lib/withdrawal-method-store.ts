import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import type { RowDataPacket } from "mysql2/promise"
import { getDatabasePool } from "@/lib/database"

export type UpiPayoutDetails = {
  method: "upi"
  upiId: string
  accountHolder: string
}

export type BankPayoutDetails = {
  method: "bank"
  accountNumber: string
  ifscCode: string
  accountHolder: string
}

export type PayoutDetails = UpiPayoutDetails | BankPayoutDetails

export type WithdrawalMethodSummary = {
  method: PayoutDetails["method"]
  accountHolder: string
  destination: string
  updatedAt: string
}

type WithdrawalMethodRow = RowDataPacket & {
  method_type: PayoutDetails["method"]
  encrypted_payload: string
  iv: string
  auth_tag: string
  updated_at: Date | string
}

export class WithdrawalMethodAlreadyExistsError extends Error {
  constructor() {
    super("A withdrawal method is already saved for this account.")
    this.name = "WithdrawalMethodAlreadyExistsError"
  }
}

function getEncryptionKey(): Buffer {
  const configuredKey = process.env.PAYOUT_DATA_ENCRYPTION_KEY?.trim()
  if (!configuredKey || !/^[0-9a-f]{64}$/i.test(configuredKey)) {
    throw new Error("PAYOUT_DATA_ENCRYPTION_KEY must be a 64-character hexadecimal key.")
  }
  return Buffer.from(configuredKey, "hex")
}

function encryptDetails(details: PayoutDetails) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(details), "utf8"),
    cipher.final(),
  ])

  return {
    encryptedPayload: encrypted.toString("base64"),
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex"),
  }
}

function decryptDetails(row: WithdrawalMethodRow): PayoutDetails {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(row.iv, "hex"),
  )
  decipher.setAuthTag(Buffer.from(row.auth_tag, "hex"))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_payload, "base64")),
    decipher.final(),
  ]).toString("utf8")
  const details: unknown = JSON.parse(plaintext)

  if (
    typeof details !== "object" ||
    details === null ||
    !("method" in details) ||
    details.method !== row.method_type ||
    !("accountHolder" in details) ||
    typeof details.accountHolder !== "string"
  ) {
    throw new Error("The saved withdrawal method could not be read.")
  }

  if (details.method === "upi" && "upiId" in details && typeof details.upiId === "string") {
    return {
      method: "upi",
      upiId: details.upiId,
      accountHolder: details.accountHolder,
    }
  }
  if (
    details.method === "bank" &&
    "accountNumber" in details &&
    typeof details.accountNumber === "string" &&
    "ifscCode" in details &&
    typeof details.ifscCode === "string"
  ) {
    return {
      method: "bank",
      accountNumber: details.accountNumber,
      ifscCode: details.ifscCode,
      accountHolder: details.accountHolder,
    }
  }

  throw new Error("The saved withdrawal method could not be read.")
}

function getMaskedDestination(details: PayoutDetails) {
  if (details.method === "bank") return `Account ending in ${details.accountNumber.slice(-4)}`

  const [accountName, provider] = details.upiId.split("@")
  const visiblePrefix = accountName.slice(0, 1)
  return `${visiblePrefix}${"•".repeat(Math.min(Math.max(accountName.length - 1, 3), 8))}@${provider}`
}

export async function getWithdrawalMethod(userId: string): Promise<WithdrawalMethodSummary | null> {
  const [rows] = await getDatabasePool().execute<WithdrawalMethodRow[]>(
    `SELECT method_type, encrypted_payload, iv, auth_tag, updated_at
     FROM user_withdrawal_methods
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
  )
  const row = rows[0]
  if (!row) return null

  const details = decryptDetails(row)
  const updatedAt = row.updated_at instanceof Date
    ? row.updated_at.toISOString()
    : new Date(row.updated_at).toISOString()

  return {
    method: details.method,
    accountHolder: details.accountHolder,
    destination: getMaskedDestination(details),
    updatedAt,
  }
}

export async function getWithdrawalPayoutDetails(userId: string): Promise<PayoutDetails | null> {
  const [rows] = await getDatabasePool().execute<WithdrawalMethodRow[]>(
    `SELECT method_type, encrypted_payload, iv, auth_tag, updated_at
     FROM user_withdrawal_methods
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
  )
  return rows[0] ? decryptDetails(rows[0]) : null
}

export async function saveWithdrawalMethod(userId: string, details: PayoutDetails): Promise<void> {
  const { encryptedPayload, iv, authTag } = encryptDetails(details)

  try {
    await getDatabasePool().execute(
      `INSERT INTO user_withdrawal_methods
         (user_id, method_type, encrypted_payload, iv, auth_tag)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, details.method, encryptedPayload, iv, authTag],
    )
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      throw new WithdrawalMethodAlreadyExistsError()
    }
    throw error
  }
}
