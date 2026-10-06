import nextEnv from "@next/env"
import { randomInt } from "node:crypto"
import mysql from "mysql2/promise"

nextEnv.loadEnvConfig(process.cwd())

const PUBLIC_UID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

function generatePublicUserId() {
  let suffix = ""
  for (let index = 0; index < 12; index += 1) {
    suffix += PUBLIC_UID_ALPHABET[randomInt(PUBLIC_UID_ALPHABET.length)]
  }
  return `LU-${suffix}`
}

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
      public_uid VARCHAR(15) NULL,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash VARCHAR(200) NOT NULL,
      date_of_birth DATE NOT NULL,
      telegram_username VARCHAR(32) NULL,
      x_username VARCHAR(15) NULL,
      name_edit_used TINYINT(1) NOT NULL DEFAULT 0,
      date_of_birth_edit_used TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [socialUsernameColumns] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'auth_users'
       AND COLUMN_NAME IN ('telegram_username', 'x_username')`,
  )
  const existingSocialUsernameColumns = new Set(
    socialUsernameColumns.map((column) => column.COLUMN_NAME),
  )
  if (!existingSocialUsernameColumns.has("telegram_username")) {
    await pool.execute("ALTER TABLE auth_users ADD COLUMN telegram_username VARCHAR(32) NULL")
  }
  if (!existingSocialUsernameColumns.has("x_username")) {
    await pool.execute("ALTER TABLE auth_users ADD COLUMN x_username VARCHAR(15) NULL")
  }

  const [profileEditColumns] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'auth_users'
       AND COLUMN_NAME IN ('name_edit_used', 'date_of_birth_edit_used')`,
  )
  const existingProfileEditColumns = new Set(profileEditColumns.map((column) => column.COLUMN_NAME))
  if (!existingProfileEditColumns.has("name_edit_used")) {
    await pool.execute(
      "ALTER TABLE auth_users ADD COLUMN name_edit_used TINYINT(1) NOT NULL DEFAULT 0",
    )
  }
  if (!existingProfileEditColumns.has("date_of_birth_edit_used")) {
    await pool.execute(
      "ALTER TABLE auth_users ADD COLUMN date_of_birth_edit_used TINYINT(1) NOT NULL DEFAULT 0",
    )
  }

  const [publicUidColumns] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'auth_users'
       AND COLUMN_NAME = 'public_uid'`,
  )
  if (publicUidColumns.length === 0) {
    await pool.execute("ALTER TABLE auth_users ADD COLUMN public_uid VARCHAR(15) NULL")
  }

  const [publicUidIndexes] = await pool.execute(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'auth_users'
       AND INDEX_NAME = 'auth_users_public_uid_uq'`,
  )
  if (publicUidIndexes.length === 0) {
    await pool.execute(
      "ALTER TABLE auth_users ADD UNIQUE INDEX auth_users_public_uid_uq (public_uid)",
    )
  }

  const [usersWithoutPublicUid] = await pool.execute(
    "SELECT id FROM auth_users WHERE public_uid IS NULL OR public_uid = ''",
  )
  for (const user of usersWithoutPublicUid) {
    let assigned = false
    for (let attempt = 0; attempt < 10 && !assigned; attempt += 1) {
      try {
        const [result] = await pool.execute(
          "UPDATE auth_users SET public_uid = ? WHERE id = ? AND (public_uid IS NULL OR public_uid = '')",
          [generatePublicUserId(), user.id],
        )
        assigned = result.affectedRows === 1 || result.affectedRows === 0
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ER_DUP_ENTRY"
        ) {
          continue
        }
        throw error
      }
    }
    if (!assigned) throw new Error("Could not assign a unique public UID to an existing account.")
  }

  await pool.execute("ALTER TABLE auth_users MODIFY public_uid VARCHAR(15) NOT NULL")

  const [userColumns] = await pool.execute(
    `SELECT COLUMN_NAME, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'auth_users'
       AND COLUMN_NAME IN ('email', 'password_hash', 'date_of_birth')`,
  )
  const nullableColumns = new Map(userColumns.map((column) => [column.COLUMN_NAME, column.IS_NULLABLE]))
  for (const [column, definition] of [
    ["email", "VARCHAR(254) NULL"],
    ["password_hash", "VARCHAR(200) NULL"],
    ["date_of_birth", "DATE NULL"],
  ]) {
    if (nullableColumns.get(column) === "NO") {
      await pool.execute(`ALTER TABLE auth_users MODIFY ${column} ${definition}`)
    }
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS auth_identities (
      provider VARCHAR(20) NOT NULL,
      provider_user_id VARCHAR(191) NOT NULL,
      user_id CHAR(36) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (provider, provider_user_id),
      INDEX auth_identities_user_id_idx (user_id),
      CONSTRAINT auth_identities_user_fk
        FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
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
