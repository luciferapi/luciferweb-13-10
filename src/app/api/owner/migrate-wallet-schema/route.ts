import { NextResponse } from "next/server"
import { requireOwnerAccess } from "@/features/auth/server/owner-access"
import { getMysqlPool } from "@/lib/mysql"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const unauthorized = await requireOwnerAccess()
  if (unauthorized) return unauthorized

  const pool = getMysqlPool()
  const statements = [
    `CREATE TABLE IF NOT EXISTS wallet_deposits (
      deposit_id VARCHAR(255) NOT NULL UNIQUE,
      payment_id VARCHAR(255) NULL UNIQUE,
      order_id VARCHAR(255) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      amount_paise BIGINT UNSIGNED NOT NULL,
      currency CHAR(3) NOT NULL DEFAULT 'INR',
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      payment_details JSON NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      paid_at DATETIME(3) NULL,
      KEY wallet_deposits_user_date_idx (user_id, created_at),
      CONSTRAINT wallet_deposits_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS wallet_withdrawal_requests (
      request_id CHAR(36) PRIMARY KEY,
      withdrawal_id VARCHAR(255) NOT NULL UNIQUE,
      user_id CHAR(36) NOT NULL,
      amount_paise BIGINT UNSIGNED NOT NULL,
      method_type VARCHAR(16) NOT NULL,
      payout_destination VARCHAR(512) NOT NULL,
      request_date DATE NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      owner_response VARCHAR(1000) NULL,
      payment_reference VARCHAR(120) NULL,
      owner_note VARCHAR(1000) NULL,
      processed_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY wallet_withdrawals_user_date_idx (user_id, request_date),
      KEY wallet_withdrawals_status_user_idx (status, user_id),
      CONSTRAINT wallet_withdrawals_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS owner_wallet_adjustments (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      actor_user_id CHAR(36) NULL,
      amount_paise BIGINT NOT NULL,
      reason VARCHAR(500) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY owner_wallet_adjustments_user_created_idx (user_id, created_at),
      CONSTRAINT owner_wallet_adjustments_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
      CONSTRAINT owner_wallet_adjustments_actor_fk FOREIGN KEY (actor_user_id) REFERENCES auth_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS wallet_purchase_debits (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      purchase_key VARCHAR(160) NOT NULL,
      user_id VARCHAR(191) NOT NULL,
      amount_paise BIGINT NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_wallet_purchase_debits_key (purchase_key),
      KEY idx_wallet_purchase_debits_user (user_id, created_at),
      CONSTRAINT fk_wallet_purchase_debits_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ]

  try {
    for (const statement of statements) await pool.execute(statement)
    const compatibilityColumns = [
      ["owner_response", "VARCHAR(1000) NULL"],
      ["payment_reference", "VARCHAR(120) NULL"],
      ["owner_note", "VARCHAR(1000) NULL"],
      ["processed_at", "DATETIME(3) NULL"],
    ] as const
    for (const [column, definition] of compatibilityColumns) {
      try {
        await pool.execute(`ALTER TABLE wallet_withdrawal_requests ADD COLUMN ${column} ${definition}`)
      } catch (error) {
        if (!(error instanceof Error && /duplicate column|already exists/i.test(error.message))) throw error
      }
    }
    try {
      await pool.execute("ALTER TABLE wallet_purchase_debits ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'paid' AFTER amount_paise")
    } catch (error) {
      if (!(error instanceof Error && /duplicate column|already exists/i.test(error.message))) throw error
    }
    try {
      await pool.execute("CREATE INDEX idx_wallet_purchase_debits_user_status ON wallet_purchase_debits (user_id, status)")
    } catch (error) {
      if (!(error instanceof Error && /duplicate key|already exists/i.test(error.message))) throw error
    }
    return NextResponse.json({ success: true, message: "Wallet schema migrations applied." })
  } catch (error) {
    console.error("Could not apply wallet schema migrations.", error)
    return NextResponse.json({ error: "Could not apply wallet schema migrations." }, { status: 500 })
  }
}
