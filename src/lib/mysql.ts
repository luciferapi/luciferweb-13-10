import "server-only"
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise"

type MysqlConfig = {
  host: string
  port: number
  user: string
  password: string
  database: string
  connectionLimit: number
  ssl: boolean
}

export type MysqlValue = string | number | bigint | boolean | Date | Buffer | null

declare global {
  var __luciferMysqlPool: Pool | undefined
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required to connect to the MySQL database.`)
  return value
}

function positiveIntegerEnvironmentValue(name: string, fallback: number, maximum: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}.`)
  }
  return value
}

function getMysqlConfig(): MysqlConfig {
  const sslValue = process.env.DB_SSL?.trim().toLowerCase()
  if (sslValue && sslValue !== "true" && sslValue !== "false") {
    throw new Error("DB_SSL must be either true or false.")
  }

  return {
    host: requiredEnvironmentValue("DB_HOST"),
    port: positiveIntegerEnvironmentValue("DB_PORT", 3306, 65535),
    user: requiredEnvironmentValue("DB_USER"),
    password: requiredEnvironmentValue("DB_PASSWORD"),
    database: requiredEnvironmentValue("DB_NAME"),
    connectionLimit: positiveIntegerEnvironmentValue("DB_CONNECTION_LIMIT", 10, 100),
    ssl: sslValue === "true",
  }
}

export function isMysqlConfigured(): boolean {
  return Boolean(
    process.env.DB_HOST?.trim() &&
    process.env.DB_USER?.trim() &&
    process.env.DB_PASSWORD &&
    process.env.DB_NAME?.trim(),
  )
}

export function isMysqlSchemaUnavailable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const code = "code" in error && typeof error.code === "string" ? error.code : ""
  const errno = "errno" in error && typeof error.errno === "number" ? error.errno : 0
  return code === "ER_BAD_FIELD_ERROR" || code === "ER_NO_SUCH_TABLE" || errno === 1054 || errno === 1146
}

export function getMysqlPool(): Pool {
  if (globalThis.__luciferMysqlPool) return globalThis.__luciferMysqlPool

  const config = getMysqlConfig()
  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: config.connectionLimit,
    waitForConnections: true,
    queueLimit: 0,
    charset: "utf8mb4",
    timezone: "Z",
    supportBigNumbers: true,
    bigNumberStrings: true,
    ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
  })

  globalThis.__luciferMysqlPool = pool
  return pool
}

export async function withMysqlTransaction<T>(
  operation: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await getMysqlPool().getConnection()
  try {
    await connection.beginTransaction()
    const result = await operation(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function selectMysqlRows<T extends RowDataPacket>(
  sql: string,
  values: readonly MysqlValue[] = [],
): Promise<T[]> {
  const [rows] = await getMysqlPool().execute<T[]>(sql, [...values])
  return rows
}

export function getOpenRouterConfig() {
  return {
    apiKey: process.env.OPENROUTER_API_KEY_2?.trim() || process.env.OPENROUTER_API_KEY?.trim() || null,
    url: process.env.OPENROUTER_URL_3?.trim() || process.env.OPENROUTER_URL?.trim() || "https://openrouter.ai/api/v1/chat/completions",
  }
}
