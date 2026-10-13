import "server-only"
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise"

let pool: Pool | null = null

function required(name: string, fallback?: string) {
  const value = process.env[name]?.trim() || fallback?.trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

export function getMySqlPool(): Pool {
  if (pool) return pool

  pool = mysql.createPool({
    host: required("DB_HOST_2", process.env.DB_HOST),
    port: Number(process.env.DB_PORT ?? 3306),
    user: required("DB_USER_2", process.env.DB_USER),
    password: required("DB_PASSWORD_2", process.env.DB_PASSWORD),
    database: required("DB_NAME_2", process.env.DB_NAME ?? "lucifer"),
    connectionLimit: 10,
    waitForConnections: true,
    enableKeepAlive: true,
    namedPlaceholders: true,
    decimalNumbers: true,
  })

  return pool
}

export async function withMySqlConnection<T>(
  callback: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await getMySqlPool().getConnection()
  try {
    return await callback(connection)
  } finally {
    connection.release()
  }
}

export type MySqlRow = RowDataPacket
export type MySqlResult = ResultSetHeader

export async function closeMySqlPool() {
  if (!pool) return
  const currentPool = pool
  pool = null
  await currentPool.end()
}

export function getOpenRouterConfig() {
  return {
    apiKey: process.env.OPENROUTER_API_KEY_2?.trim() || process.env.OPENROUTER_API_KEY?.trim() || null,
    url: process.env.OPENROUTER_URL_3?.trim() || process.env.OPENROUTER_URL?.trim() || "https://openrouter.ai/api/v1/chat/completions",
  }
}

export { mysql }
