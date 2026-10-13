import "server-only"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const PAGE_SIZE = 25
const RECIPIENT_BATCH_SIZE = 25

export type OwnerBroadcastRecipient = {
  id: string
  publicUid: string
  name: string
  email: string
}

function getAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  return client
}

function normalizeSearch(value: string) {
  return value.replace(/[^\p{L}\p{N}@._+\- ]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80)
}

function mapRecipient(row: { id: string; public_uid: string; name: string; email: string | null }): OwnerBroadcastRecipient | null {
  const email = row.email?.trim().toLowerCase()
  if (!email) return null
  return { id: row.id, publicUid: row.public_uid, name: row.name, email }
}

export async function listOwnerBroadcastRecipients(page: number, search: string) {
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const client = getAdminClient()
  let query = client
    .from("auth_users")
    .select("id, public_uid, name, email", { count: "exact" })
    .not("email", "is", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to)

  const term = normalizeSearch(search)
  if (term) {
    const pattern = `*${term}*`
    query = query.or([
      `name.ilike.${pattern}`,
      `email.ilike.${pattern}`,
      `public_uid.ilike.${pattern}`,
    ].join(","))
  }

  const [{ data, error, count }, totalResult] = await Promise.all([
    query,
    client.from("auth_users").select("id", { count: "exact", head: true }).not("email", "is", null),
  ])
  if (error) throw error
  if (totalResult.error) throw totalResult.error
  return {
    recipients: (data ?? []).flatMap((row) => {
      const recipient = mapRecipient(row)
      return recipient ? [recipient] : []
    }),
    total: count ?? 0,
    totalRecipients: totalResult.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  }
}

export async function getOwnerBroadcastRecipients(mode: "all" | "selected", userIds: string[]) {
  const client = getAdminClient()
  if (mode === "selected") {
    const uniqueIds = [...new Set(userIds)]
    const { data, error } = await client
      .from("auth_users")
      .select("id, public_uid, name, email")
      .in("id", uniqueIds)
    if (error) throw error
    const byId = new Map((data ?? []).map((row) => [row.id, row]))
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
  for (let from = 0; ; from += 500) {
    const { data, error } = await client
      .from("auth_users")
      .select("id, public_uid, name, email")
      .not("email", "is", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + 499)
    if (error) throw error
    const rows = data ?? []
    recipients.push(...rows.flatMap((row) => {
      const recipient = mapRecipient(row)
      return recipient ? [recipient] : []
    }))
    if (rows.length < 500) return recipients
  }
}

export const OWNER_BROADCAST_BATCH_SIZE = RECIPIENT_BATCH_SIZE
