import mysql from "mysql2/promise"
import { Client } from "pg"
import { existsSync } from "node:fs"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")

const applicationTables = [
  "auth_users",
  "projects",
  "api_endpoints",
  "project_purchases",
  "project_requests",
  "wallet_deposits",
  "wallet_withdrawal_requests",
  "user_withdrawal_methods",
  "referral_profiles",
  "referrals",
  "referral_program_settings",
  "owner_admins",
  "owner_audit_logs",
  "owner_wallet_adjustments",
  "api_endpoint_purchases",
  "support_tickets",
  "support_ticket_messages",
  "owner_live_banners",
  "site_maintenance_pages",
]
const pageSize = 500

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function quoteIdentifier(identifier) {
  return `\`${identifier.replaceAll("`", "``")}\``
}

function safeCount(value, label) {
  const count = Number(value)
  if (!Number.isSafeInteger(count) || count < 0) throw new Error(`${label} is outside the supported range.`)
  return count
}

function normalizeMigratedRow(table, row, targetColumns) {
  const columns = []
  const values = []
  for (const [column, columnType] of targetColumns) {
    if (table === "auth_users" && column === "password_hash") {
      columns.push(column)
      values.push(null)
      continue
    }
    if (!Object.hasOwn(row, column)) continue
    const value = row[column]
    columns.push(column)
    values.push(columnType === "json" && value !== null ? JSON.stringify(value) : value)
  }
  if (columns.length === 0) throw new Error(`No compatible columns were found for ${table}.`)
  return { columns, values }
}

async function readTargetColumns(connection, table) {
  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME, DATA_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  )
  if (rows.length === 0) throw new Error(`The MySQL table ${table} is missing; apply the schema first.`)
  return new Map(rows.map((row) => [row.COLUMN_NAME, row.DATA_TYPE]))
}

async function importTable(source, destination, table, targetColumns) {
  const quotedTable = `"${table}"`
  const { rows: countRows } = await source.query(`SELECT COUNT(*) AS row_count FROM public.${quotedTable}`)
  const rowCount = safeCount(countRows[0]?.row_count, `Source row count for ${table}`)
  let copied = 0
  for (let offset = 0; offset < rowCount; offset += pageSize) {
    const { rows } = await source.query(
      `SELECT * FROM public.${quotedTable} LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    )
    for (let start = 0; start < rows.length; start += 100) {
      const batch = rows.slice(start, start + 100)
      if (batch.length === 0) continue
      const normalized = batch.map((row) => normalizeMigratedRow(table, row, targetColumns))
      const columns = normalized[0].columns
      if (normalized.some(({ columns: rowColumns }) => rowColumns.join("\0") !== columns.join("\0"))) {
        throw new Error(`The source rows for ${table} do not have a consistent shape.`)
      }
      const columnSql = columns.map(quoteIdentifier).join(", ")
      const rowSql = normalized.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ")
      const values = normalized.flatMap(({ values: rowValues }) => rowValues)
      await destination.query(
        `INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES ${rowSql}`,
        values,
      )
      copied += batch.length
    }
  }
  if (copied !== rowCount) throw new Error(`Imported ${copied} of ${rowCount} rows from ${table}.`)
  console.log(`${table}: ${copied} rows`)
  return copied
}

async function importIdentities(source, destination, importedUserIds) {
  const [sourceIdentities, oauthIdentities] = await Promise.all([
    source.query("SELECT provider, provider_user_id, user_id FROM public.auth_identities"),
    source.query(
      `SELECT provider, provider_id AS provider_user_id, user_id
       FROM auth.identities
       WHERE provider IN ('google', 'twitter', 'telegram')`,
    ),
  ])
  const identities = new Map()
  for (const row of [...sourceIdentities.rows, ...oauthIdentities.rows]) {
    if (
      !importedUserIds.has(row.user_id) ||
      !["google", "twitter", "telegram"].includes(row.provider) ||
      typeof row.provider_user_id !== "string" ||
      !row.provider_user_id
    ) continue
    identities.set(`${row.provider}\0${row.provider_user_id}`, row)
  }

  for (const userId of importedUserIds) {
    identities.set(`password\0${userId}`, {
      provider: "password",
      provider_user_id: userId,
      user_id: userId,
    })
  }
  for (const row of identities.values()) {
    await destination.execute(
      `INSERT INTO auth_identities (provider, provider_user_id, user_id)
       VALUES (?, ?, ?)`,
      [row.provider, row.provider_user_id, row.user_id],
    )
  }
  console.log(`auth_identities: ${identities.size} provider links`)
}

async function main() {
  const mode = process.argv[2]
  if (mode !== "--dry-run" && mode !== "--apply") {
    throw new Error("Choose --dry-run first, then --apply after reviewing the migration plan.")
  }
  const sourceUrl = required("SOURCE_DATABASE_URL")
  const host = required("DB_HOST")
  const user = required("DB_USER")
  const password = required("DB_PASSWORD")
  const database = required("DB_NAME")
  const port = Number(process.env.DB_PORT?.trim() || "3306")
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("DB_PORT must be an integer between 1 and 65535.")
  }
  const source = new Client({
    connectionString: sourceUrl,
    ssl: { rejectUnauthorized: true },
    application_name: "lucifer-supabase-migration",
  })
  const destination = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    connectionLimit: 2,
    waitForConnections: true,
    queueLimit: 0,
    charset: "utf8mb4",
    timezone: "Z",
    supportBigNumbers: true,
    bigNumberStrings: true,
    ssl: process.env.DB_SSL?.trim().toLowerCase() === "true" ? { rejectUnauthorized: true } : undefined,
  })
  let connection
  let transactionStarted = false
  try {
    await source.connect()
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    connection = await destination.getConnection()

    for (const table of applicationTables) {
      const targetCountRows = table === "referral_program_settings"
        ? await connection.query(`SELECT COUNT(*) AS row_count FROM ${quoteIdentifier(table)} WHERE program_id <> 1`)
        : await connection.query(`SELECT COUNT(*) AS row_count FROM ${quoteIdentifier(table)}`)
      const targetCount = safeCount(targetCountRows[0][0]?.row_count, `Existing row count for ${table}`)
      if (targetCount !== 0) {
        throw new Error(`The target table ${table} is not empty. Stop; this importer only runs against a clean target.`)
      }
    }

    const sourceCounts = new Map()
    for (const table of applicationTables) {
      const result = await source.query(`SELECT COUNT(*) AS row_count FROM public."${table}"`)
      sourceCounts.set(table, safeCount(result.rows[0]?.row_count, `Source row count for ${table}`))
    }
    const sourceUsers = await source.query('SELECT id FROM public."auth_users"')
    const importedUserIds = new Set(sourceUsers.rows.map((row) => row.id))
    const providerRows = await source.query(
      `SELECT COUNT(*) AS row_count FROM auth.identities
       WHERE provider IN ('google', 'twitter', 'telegram')`,
    )
    const targetColumnsByTable = new Map()
    for (const table of applicationTables) {
      targetColumnsByTable.set(table, await readTargetColumns(connection, table))
    }
    console.log(`Source profiles: ${importedUserIds.size}`)
    console.log(`Source social identities: ${safeCount(providerRows.rows[0]?.row_count, "Social identity count")}`)
    for (const table of applicationTables) console.log(`${table}: ${sourceCounts.get(table)} source rows`)
    if (mode === "--dry-run") {
      console.log("Dry run complete. No application data was written.")
      return
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 0")
    await connection.beginTransaction()
    transactionStarted = true
    if (sourceCounts.get("referral_program_settings") > 0) {
      await connection.query("DELETE FROM referral_program_settings")
    }

    let totalCopied = 0
    for (const table of applicationTables) {
      if (table === "referral_program_settings" && sourceCounts.get(table) === 0) continue
      totalCopied += await importTable(source, connection, table, targetColumnsByTable.get(table))
    }
    await importIdentities(source, connection, importedUserIds)
    if (sourceCounts.get("referral_program_settings") === 0) {
      await connection.query("INSERT IGNORE INTO referral_program_settings (program_id) VALUES (1)")
    }
    await connection.commit()
    transactionStarted = false
    console.log(`Migration completed: ${totalCopied} application rows copied.`)
    console.log("Existing password hashes and sessions were not migrated; users must reset their passwords and sign in again.")
  } catch (error) {
    if (transactionStarted && connection) await connection.rollback()
    const message = error instanceof Error ? error.message.slice(0, 300) : "Unknown migration error."
    console.error("Migration failed. Database credentials were not printed.", message)
    process.exitCode = 1
  } finally {
    if (connection) {
      try {
        await connection.query("SET FOREIGN_KEY_CHECKS = 1")
      } finally {
        connection.release()
      }
    }
    await Promise.allSettled([source.end(), destination.end()])
  }
}

await main()
