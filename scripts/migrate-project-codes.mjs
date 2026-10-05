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
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'code'`,
  )
  if (columns.length === 0) {
    await pool.execute("ALTER TABLE projects ADD COLUMN code VARCHAR(100) NULL AFTER id")
  }

  await pool.execute("UPDATE projects SET code = id WHERE code IS NULL OR code = ''")
  await pool.execute("ALTER TABLE projects MODIFY code VARCHAR(100) NOT NULL")

  const [indexes] = await pool.execute(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'projects'
       AND INDEX_NAME = 'projects_code_uq'`,
  )
  if (indexes.length === 0) {
    await pool.execute("ALTER TABLE projects ADD UNIQUE INDEX projects_code_uq (code)")
  }
  console.log("Unique project codes are ready; existing projects retain their current codes.")
} finally {
  await pool.end()
}
