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

const endpoints = [
  { id: "wingo1m", name: "Wingo 1M", path: "wingo1m.php", note: "1-minute result history", category: "Wingo" },
  { id: "wingo30s", name: "Wingo 30 Sec", path: "30sec.php", note: "30-second result history", category: "Wingo" },
  { id: "trx1m", name: "TRX 1M", path: "trx1m.php", note: "1-minute result history", category: "TRX" },
  { id: "k3_1m", name: "K3 1M", path: "k3_1m.php", note: "1-minute result history", category: "K3" },
  { id: "d5_1m", name: "D5 1M", path: "d5_1m.php", note: "1-minute result history", category: "D5" },
]

try {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS api_endpoints (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      endpoint_path VARCHAR(200) NOT NULL,
      note VARCHAR(300) NOT NULL,
      category VARCHAR(60) NOT NULL,
      image_url VARCHAR(500) NOT NULL DEFAULT '',
      demo_video VARCHAR(200) NULL,
      link_url VARCHAR(300) NOT NULL DEFAULT '',
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX api_endpoints_enabled_idx (is_enabled, category, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  for (const [column, definition] of [
    ["image_url", "VARCHAR(500) NOT NULL DEFAULT ''"],
    ["demo_video", "VARCHAR(200) NULL"],
    ["link_url", "VARCHAR(300) NOT NULL DEFAULT ''"],
  ]) {
    const [columns] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'api_endpoints' AND COLUMN_NAME = ?`,
      [column],
    )
    if (columns.length === 0) {
      await pool.execute(`ALTER TABLE api_endpoints ADD COLUMN ${column} ${definition}`)
    }
  }

  for (const endpoint of endpoints) {
    await pool.execute(
      `INSERT INTO api_endpoints (id, name, endpoint_path, note, category)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = VALUES(id)`,
      [endpoint.id, endpoint.name, endpoint.path, endpoint.note, endpoint.category],
    )
  }
  console.log("API endpoint catalog is ready.")
} finally {
  await pool.end()
}
