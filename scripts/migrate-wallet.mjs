import nextEnv from "@next/env"
import mysql from "mysql2/promise"
import { randomInt } from "node:crypto"

nextEnv.loadEnvConfig(process.cwd())

const connectionString = process.env.DATABASE_URL
const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env
if (!connectionString && (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME)) {
  throw new Error("Set DATABASE_URL or DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME in .env.local.")
}

const pool = mysql.createPool(connectionString || {
  host: DB_HOST,
  port: Number(process.env.DB_PORT ?? "3306"),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? "10"),
  queueLimit: 0,
  connectTimeout: 10_000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: "utf8mb4",
})

const alphanumeric = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
function generateTransactionId(prefix) {
  let suffix = ""
  for (let index = 0; index < 13; index += 1) {
    suffix += alphanumeric[randomInt(alphanumeric.length)]
  }
  return `${prefix}${suffix}`
}

async function ensureIdColumn(tableName, columnName, primaryColumn, prefix, indexName) {
  const [columns] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName],
  )
  if (columns.length === 0) {
    await pool.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` CHAR(16) NULL`)
  }

  const [rows] = await pool.execute(
    `SELECT \`${primaryColumn}\` AS row_id, \`${columnName}\` AS transaction_id
     FROM \`${tableName}\``,
  )
  const validId = new RegExp(`^${prefix}[A-Z0-9]{13}$`)
  const usedIds = new Set(
    rows
      .map((row) => row.transaction_id)
      .filter((transactionId) => typeof transactionId === "string" && validId.test(transactionId)),
  )
  for (const row of rows) {
    if (typeof row.transaction_id === "string" && validId.test(row.transaction_id)) continue
    let transactionId
    do {
      transactionId = generateTransactionId(prefix)
    } while (usedIds.has(transactionId))
    usedIds.add(transactionId)
    await pool.execute(
      `UPDATE \`${tableName}\` SET \`${columnName}\` = ? WHERE \`${primaryColumn}\` = ?`,
      [transactionId, row.row_id],
    )
  }

  await pool.execute(`ALTER TABLE \`${tableName}\` MODIFY \`${columnName}\` CHAR(16) NOT NULL`)
  const [indexes] = await pool.execute(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName],
  )
  if (indexes.length === 0) {
    await pool.execute(`ALTER TABLE \`${tableName}\` ADD UNIQUE KEY \`${indexName}\` (\`${columnName}\`)`)
  }
}

try {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS wallet_deposits (
      deposit_id CHAR(16) NOT NULL,
      payment_id VARCHAR(40) NULL,
      order_id VARCHAR(40) NOT NULL UNIQUE,
      user_id CHAR(36) NOT NULL,
      amount_paise BIGINT UNSIGNED NOT NULL,
      currency CHAR(3) NOT NULL,
      status ENUM('pending', 'paid', 'cancelled', 'expired', 'failed') NOT NULL DEFAULT 'pending',
      payment_details JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMP NULL DEFAULT NULL,
      INDEX wallet_deposits_user_date_idx (user_id, created_at),
      UNIQUE KEY wallet_deposits_payment_id_uq (payment_id),
      CONSTRAINT wallet_deposits_user_fk
        FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [paymentDetailsColumn] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallet_deposits'
       AND COLUMN_NAME = 'payment_details'`,
  )
  if (paymentDetailsColumn.length === 0) {
    await pool.execute("ALTER TABLE wallet_deposits ADD COLUMN payment_details JSON NULL")
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS wallet_withdrawal_requests (
      request_id CHAR(36) NOT NULL PRIMARY KEY,
      withdrawal_id CHAR(16) NOT NULL,
      user_id CHAR(36) NOT NULL,
      amount_paise BIGINT UNSIGNED NOT NULL,
      method_type ENUM('upi', 'bank') NOT NULL,
      payout_destination VARCHAR(255) NOT NULL,
      request_date DATE NOT NULL,
      status ENUM('pending', 'paid', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX wallet_withdrawals_user_date_idx (user_id, request_date),
      CONSTRAINT wallet_withdrawals_user_fk
        FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await ensureIdColumn(
    "wallet_deposits",
    "deposit_id",
    "order_id",
    "DEP",
    "wallet_deposits_deposit_id_uq",
  )
  await ensureIdColumn(
    "wallet_withdrawal_requests",
    "withdrawal_id",
    "request_id",
    "WIT",
    "wallet_withdrawals_withdrawal_id_uq",
  )

  console.log("Wallet deposit and withdrawal tables are ready.")
} finally {
  await pool.end()
}
