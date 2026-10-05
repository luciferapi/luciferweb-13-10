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
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'project_number'`,
  )
  if (columns.length === 0) {
    await pool.execute(
      "ALTER TABLE projects ADD COLUMN project_number INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE FIRST",
    )
  }

  console.log("Unique numeric project IDs are ready.")
} finally {
  await pool.end()
}
