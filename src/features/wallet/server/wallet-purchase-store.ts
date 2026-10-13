import "server-only"
import { withMysqlTransaction } from "@/lib/mysql"
import type { ResultSetHeader, RowDataPacket } from "mysql2"

export type WalletPurchaseApplication = {
  walletAppliedPaise: number
  remainingPaise: number
  walletOnly: boolean
}

export async function applyWalletBalance(input: {
  userId: string
  purchaseKey: string
  totalPaise: number
}): Promise<WalletPurchaseApplication> {
  if (!Number.isSafeInteger(input.totalPaise) || input.totalPaise < 1) throw new Error("Purchase amount is invalid.")

  return withMysqlTransaction(async (connection) => {
    const [existing] = await connection.execute<(RowDataPacket & { amount_paise: number | string })[]>(
      "SELECT amount_paise FROM wallet_purchase_debits WHERE purchase_key = ? AND user_id = ? FOR UPDATE",
      [input.purchaseKey, input.userId],
    )
    if (existing.length > 0) {
      const applied = Number(existing[0].amount_paise)
      return { walletAppliedPaise: applied, remainingPaise: input.totalPaise, walletOnly: false }
    }

    await connection.execute("SELECT id FROM auth_users WHERE id = ? FOR UPDATE", [input.userId])
    const [rows] = await connection.execute<(RowDataPacket & { balance_paise: number | string | null })[]>(
      `SELECT
        COALESCE((SELECT SUM(amount_paise) FROM wallet_deposits WHERE user_id = ? AND status = 'paid'), 0)
        - COALESCE((SELECT SUM(amount_paise) FROM wallet_withdrawal_requests WHERE user_id = ? AND status IN ('pending', 'paid')), 0)
        + COALESCE((SELECT SUM(amount_paise) FROM owner_wallet_adjustments WHERE user_id = ?), 0)
        - COALESCE((SELECT SUM(amount_paise) FROM wallet_purchase_debits WHERE user_id = ?), 0) AS balance_paise`,
      [input.userId, input.userId, input.userId, input.userId],
    )
    const balance = Math.max(Number(rows[0]?.balance_paise ?? 0), 0)
    if (!Number.isSafeInteger(balance)) throw new Error("Wallet balance is invalid.")
    const applied = Math.min(balance, input.totalPaise)
    if (applied === 0) return { walletAppliedPaise: 0, remainingPaise: input.totalPaise, walletOnly: false }

    await connection.execute<ResultSetHeader>(
      "INSERT INTO wallet_purchase_debits (purchase_key, user_id, amount_paise) VALUES (?, ?, ?)",
      [input.purchaseKey, input.userId, applied],
    )
    return { walletAppliedPaise: applied, remainingPaise: input.totalPaise - applied, walletOnly: applied === input.totalPaise }
  })
}
