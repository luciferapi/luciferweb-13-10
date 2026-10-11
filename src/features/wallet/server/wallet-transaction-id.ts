import { randomInt } from "node:crypto"

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const WALLET_TRANSACTION_ID_LENGTH = 16

export type WalletTransactionPrefix = "DEP" | "WIT"

export function generateWalletTransactionId(prefix: WalletTransactionPrefix): string {
  const suffixLength = WALLET_TRANSACTION_ID_LENGTH - prefix.length
  let suffix = ""
  for (let index = 0; index < suffixLength; index += 1) {
    suffix += ALPHANUMERIC[randomInt(ALPHANUMERIC.length)]
  }
  return `${prefix}${suffix}`
}
