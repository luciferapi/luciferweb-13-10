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
    CREATE TABLE IF NOT EXISTS project_requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_ref CHAR(36) NOT NULL UNIQUE,
      user_id CHAR(36) NOT NULL,
      project_name VARCHAR(120) NOT NULL,
      description TEXT NOT NULL,
      contact_email VARCHAR(254) NULL,
      whatsapp_number VARCHAR(25) NULL,
      telegram_id VARCHAR(64) NULL,
      preferred_language VARCHAR(80) NULL,
      desired_duration VARCHAR(160) NULL,
      order_id VARCHAR(40) NOT NULL UNIQUE,
      payment_id VARCHAR(40) NULL UNIQUE,
      payment_amount_paise INT UNSIGNED NOT NULL,
      payment_status ENUM('pending', 'paid', 'cancelled', 'failed') NOT NULL DEFAULT 'pending',
      status ENUM('awaiting_payment', 'pending', 'cancelled', 'failed') NOT NULL DEFAULT 'awaiting_payment',
      notification_status ENUM('pending', 'sending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX project_requests_user_date_idx (user_id, created_at),
      CONSTRAINT project_requests_user_fk
        FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  for (const [column, definition] of [
    ["contact_email", "VARCHAR(254) NULL"],
    ["whatsapp_number", "VARCHAR(25) NULL"],
    ["telegram_id", "VARCHAR(64) NULL"],
    ["preferred_language", "VARCHAR(80) NULL"],
    ["desired_duration", "VARCHAR(160) NULL"],
  ]) {
    const [columns] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_requests' AND COLUMN_NAME = ?`,
      [column],
    )
    if (columns.length === 0) {
      await pool.execute(`ALTER TABLE project_requests ADD COLUMN ${column} ${definition}`)
    }
  }
  console.log("Paid project request table is ready.")
} finally {
  await pool.end()
}
