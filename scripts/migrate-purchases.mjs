import nextEnv from "@next/env"
import mysql from "mysql2/promise"

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

try {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS project_purchases (
      payment_id VARCHAR(40) NULL,
      order_id VARCHAR(40) NOT NULL UNIQUE,
      user_id CHAR(36) NOT NULL,
      project_code VARCHAR(100) NOT NULL,
      project_title VARCHAR(100) NOT NULL,
      amount_paise BIGINT UNSIGNED NOT NULL,
      currency CHAR(3) NOT NULL,
      status ENUM('pending', 'paid', 'cancelled', 'expired', 'failed') NOT NULL DEFAULT 'pending',
      purchased_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX project_purchases_user_date_idx (user_id, purchased_at),
      UNIQUE KEY project_purchases_payment_id_uq (payment_id),
      CONSTRAINT project_purchases_user_fk
        FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [paymentIdIndexes] = await pool.execute(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'project_purchases'
       AND COLUMN_NAME = 'payment_id'
       AND NON_UNIQUE = 0
       AND INDEX_NAME = 'project_purchases_payment_id_uq'`,
  )
  const hasPaymentIdIndex = paymentIdIndexes.length > 0
  const [paymentIdPrimary] = await pool.execute(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'project_purchases'
       AND COLUMN_NAME = 'payment_id'
       AND INDEX_NAME = 'PRIMARY'`,
  )
  if (paymentIdPrimary.length > 0) await pool.execute("ALTER TABLE project_purchases DROP PRIMARY KEY")
  await pool.execute("ALTER TABLE project_purchases MODIFY payment_id VARCHAR(40) NULL")
  if (!hasPaymentIdIndex) {
    await pool.execute("ALTER TABLE project_purchases ADD UNIQUE KEY project_purchases_payment_id_uq (payment_id)")
  }
  await pool.execute(
    `ALTER TABLE project_purchases
     MODIFY status ENUM('pending', 'paid', 'cancelled', 'expired', 'failed') NOT NULL DEFAULT 'pending'`,
  )
  console.log("Project purchase history table is ready.")
} finally {
  await pool.end()
}
