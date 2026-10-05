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
    CREATE TABLE IF NOT EXISTS auth_users (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash VARCHAR(200) NOT NULL,
      date_of_birth DATE NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash CHAR(64) NOT NULL PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX auth_sessions_user_id_idx (user_id),
      INDEX auth_sessions_expires_at_idx (expires_at),
      CONSTRAINT auth_sessions_user_fk
        FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS auth_pending_registrations (
      email VARCHAR(254) NOT NULL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      password_hash VARCHAR(200) NOT NULL,
      date_of_birth DATE NOT NULL,
      otp_hash VARCHAR(200) NOT NULL,
      expires_at DATETIME NOT NULL,
      resend_after DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      registration_expires_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX auth_pending_registrations_expires_at_idx (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [pendingColumns] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'auth_pending_registrations'
       AND COLUMN_NAME = 'resend_after'`,
  )
  if (pendingColumns.length === 0) {
    await pool.execute(
      `ALTER TABLE auth_pending_registrations
       ADD COLUMN resend_after DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    )
  }
  const [registrationExpiryColumns] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'auth_pending_registrations'
       AND COLUMN_NAME = 'registration_expires_at'`,
  )
  if (registrationExpiryColumns.length === 0) {
    await pool.execute(
      `ALTER TABLE auth_pending_registrations
       ADD COLUMN registration_expires_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    )
    await pool.execute(
      `UPDATE auth_pending_registrations
       SET registration_expires_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)`,
    )
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS auth_password_resets (
      token_hash CHAR(64) NOT NULL PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX auth_password_resets_user_id_idx (user_id),
      INDEX auth_password_resets_expires_at_idx (expires_at),
      CONSTRAINT auth_password_resets_user_fk
        FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  console.log("Authentication tables are ready.")
} finally {
  await pool.end()
}
