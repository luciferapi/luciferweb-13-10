import "server-only"
import { selectMysqlRows } from "@/lib/mysql"
import type { RowDataPacket } from "mysql2"

const PAGE_SIZE = 25
const RECIPIENT_BATCH_SIZE = 25

export type OwnerBroadcastRecipient = {
  id: string
  publicUid: string
  name: string
  email: string
}

type RecipientRow = RowDataPacket & {
  id: string
  public_uid: string
  name: string
  email: string | null
}

function normalizeSearch(value: string) {
  return value.replace(/[^\p{L}\p{N}@._+\- ]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80)
}

function mapRecipient(row: RecipientRow): OwnerBroadcastRecipient | null {
  const email = row.email?.trim().toLowerCase()
  if (!email) return null
  return { id: row.id, publicUid: row.public_uid, name: row.name, email }
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

function recipientSearch(term: string) {
  if (!term) return { where: "", values: [] as string[] }
  const pattern = `%${escapeLike(term)}%`
  return {
    where: "AND (name LIKE ? OR email LIKE ? OR public_uid LIKE ?)",
    values: [pattern, pattern, pattern],
  }
}

export async function listOwnerBroadcastRecipients(page: number, search: string) {
  const offset = (page - 1) * PAGE_SIZE
  const { where, values } = recipientSearch(normalizeSearch(search))
  const [rows, counts] = await Promise.all([
    selectMysqlRows<RecipientRow>(
      `SELECT id, public_uid, name, email FROM auth_users
       WHERE email IS NOT NULL ${where}
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...values, PAGE_SIZE, offset],
    ),
    selectMysqlRows<RowDataPacket & { total: number | string }>(
      `SELECT COUNT(*) AS total FROM auth_users WHERE email IS NOT NULL ${where}`,
      values,
    ),
  ])
  const total = Number(counts[0]?.total ?? 0)
  if (!Number.isSafeInteger(total)) throw new Error("The broadcast recipient count is invalid.")
  return {
    recipients: rows.flatMap((row) => {
      const recipient = mapRecipient(row)
      return recipient ? [recipient] : []
    }),
    total,
    totalRecipients: total,
    page,
    pageSize: PAGE_SIZE,
  }
}

export async function getOwnerBroadcastRecipients(mode: "all" | "selected", userIds: string[]) {
  if (mode === "selected") {
    const uniqueIds = [...new Set(userIds)]
    if (uniqueIds.length === 0) return []
    const rows = await selectMysqlRows<RecipientRow>(
      `SELECT id, public_uid, name, email FROM auth_users
       WHERE id IN (${uniqueIds.map(() => "?").join(", ")})`,
      uniqueIds,
    )
    const byId = new Map(rows.map((row) => [row.id, row]))
    const recipients = uniqueIds.map((id) => {
      const row = byId.get(id)
      return row ? mapRecipient(row) : null
    })
    if (recipients.some((recipient) => recipient === null)) {
      throw new Error("One or more selected users are no longer available or do not have an email address.")
    }
    return recipients.filter((recipient): recipient is OwnerBroadcastRecipient => recipient !== null)
  }

  const recipients: OwnerBroadcastRecipient[] = []
  for (let offset = 0; ; offset += 500) {
    const rows = await selectMysqlRows<RecipientRow>(
      `SELECT id, public_uid, name, email FROM auth_users
       WHERE email IS NOT NULL
       ORDER BY created_at ASC, id ASC LIMIT 500 OFFSET ?`,
      [offset],
    )
    recipients.push(...rows.flatMap((row) => {
      const recipient = mapRecipient(row)
      return recipient ? [recipient] : []
    }))
    if (rows.length < 500) return recipients
  }
}

export const OWNER_BROADCAST_BATCH_SIZE = RECIPIENT_BATCH_SIZE
