import { createPool, type Pool } from "mysql2/promise"

let pool: Pool | undefined

export function getDatabasePool(): Pool {
  if (pool) return pool

  const connectionString = process.env.DATABASE_URL
  if (connectionString) {
    pool = createPool(connectionString)
    return pool
  }

  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env
  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    throw new Error("Set DATABASE_URL or all of DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME to connect to MySQL.")
  }

  const port = Number(process.env.DB_PORT ?? "3306")
  const connectionLimit = Number(process.env.DB_CONNECTION_LIMIT ?? "10")
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DB_PORT must be a valid TCP port.")
  }
  if (!Number.isInteger(connectionLimit) || connectionLimit < 1) {
    throw new Error("DB_CONNECTION_LIMIT must be a positive integer.")
  }

  pool = createPool({
    host: DB_HOST,
    port,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit,
    queueLimit: 0,
    connectTimeout: 10_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: "utf8mb4",
  })
  return pool
}
