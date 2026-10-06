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
  const [columns] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'auth_pending_registrations'
       AND COLUMN_NAME = 'referral_code'`,
  )
  if (columns.length === 0) {
    await pool.execute(
      "ALTER TABLE auth_pending_registrations ADD COLUMN referral_code VARCHAR(32) NULL AFTER date_of_birth",
    )
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS referral_profiles (
      user_id CHAR(36) NOT NULL PRIMARY KEY,
      referral_code VARCHAR(32) NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT referral_profiles_user_fk
        FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS referrals (
      id CHAR(36) NOT NULL PRIMARY KEY,
      referrer_id CHAR(36) NOT NULL,
      referee_id CHAR(36) NOT NULL UNIQUE,
      status ENUM('pending', 'active', 'rejected') NOT NULL DEFAULT 'pending',
      status_reason VARCHAR(500) NULL DEFAULT 'Awaiting manual review',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX referrals_referrer_created_idx (referrer_id, created_at),
      INDEX referrals_status_created_idx (status, created_at),
      CONSTRAINT referrals_referrer_fk
        FOREIGN KEY (referrer_id) REFERENCES auth_users(id) ON DELETE CASCADE,
      CONSTRAINT referrals_referee_fk
        FOREIGN KEY (referee_id) REFERENCES auth_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [referralReasonColumns] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'referrals'
       AND COLUMN_NAME = 'status_reason'`,
  )
  if (referralReasonColumns.length === 0) {
    await pool.execute(
      "ALTER TABLE referrals ADD COLUMN status_reason VARCHAR(500) NULL DEFAULT 'Awaiting manual review' AFTER status",
    )
  }
  await pool.execute(
    `UPDATE referrals SET status_reason = 'Awaiting manual review'
     WHERE status = 'pending' AND status_reason IS NULL`,
  )

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS referral_program_settings (
      program_id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      referrer_reward_type ENUM('fixed', 'percentage') NOT NULL DEFAULT 'fixed',
      referrer_reward_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      referrer_reward_currency CHAR(3) NOT NULL DEFAULT 'INR',
      referee_reward_type ENUM('fixed', 'percentage') NOT NULL DEFAULT 'fixed',
      referee_reward_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      referee_reward_currency CHAR(3) NOT NULL DEFAULT 'INR',
      min_purchase_amount DECIMAL(10,2) NULL,
      valid_until DATETIME NULL,
      max_referrals INT UNSIGNED NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await pool.execute(`
    INSERT INTO referral_program_settings (program_id)
    VALUES (1)
    ON DUPLICATE KEY UPDATE program_id = VALUES(program_id)
  `)
  await pool.execute(`
    UPDATE referral_program_settings
    SET referrer_reward_currency = 'INR'
    WHERE referrer_reward_currency <> 'INR'
  `)
  await pool.execute(`
    UPDATE referral_program_settings
    SET referee_reward_currency = 'INR'
    WHERE referee_reward_currency <> 'INR'
  `)
  await pool.execute(`
    ALTER TABLE referral_program_settings
      MODIFY referrer_reward_currency CHAR(3) NOT NULL DEFAULT 'INR',
      MODIFY referee_reward_currency CHAR(3) NOT NULL DEFAULT 'INR'
  `)

  console.log("Referral tables are ready.")
} finally {
  await pool.end()
}
