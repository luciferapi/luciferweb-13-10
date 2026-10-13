import "server-only"
import { randomUUID } from "node:crypto"
import { downloadFromCloudflareR2, getCloudflareR2Config, uploadToCloudflareR2 } from "@/features/storage/server/r2-storage"

export type MaintenanceEntry = {
  id: string
  path: string
  title: string
  message: string
  imageUrl: string | null
  isEnabled: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

type MaintenanceDocument = {
  version: 1
  entries: MaintenanceEntry[]
}

const maintenanceObjectKey = "maintenance/entries.json"

function normalizePath(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return "/"
  if (!trimmed.startsWith("/")) return `/${trimmed}`
  return trimmed.replace(/\/+$/, "") || "/"
}

function matchesMaintenancePath(entryPath: string, requestedPath: string) {
  const normalizedEntry = normalizePath(entryPath)
  const normalizedRequested = normalizePath(requestedPath)

  if (normalizedEntry === "/") return normalizedRequested === "/"
  if (normalizedEntry.endsWith("/*")) {
    const prefix = normalizedEntry.slice(0, -2)
    return normalizedRequested === prefix || normalizedRequested.startsWith(`${prefix}/`)
  }
  return normalizedRequested === normalizedEntry || normalizedRequested.startsWith(`${normalizedEntry}/`)
}

function isMaintenanceEntry(value: unknown): value is MaintenanceEntry {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string" &&
    "path" in value && typeof value.path === "string" &&
    "title" in value && typeof value.title === "string" &&
    "message" in value && typeof value.message === "string" &&
    "imageUrl" in value && (typeof value.imageUrl === "string" || value.imageUrl === null) &&
    "isEnabled" in value && typeof value.isEnabled === "boolean" &&
    "sortOrder" in value && typeof value.sortOrder === "number" &&
    "createdAt" in value && typeof value.createdAt === "string" &&
    "updatedAt" in value && typeof value.updatedAt === "string"
}

function ensureMaintenanceStorage() {
  const config = getCloudflareR2Config()
  if (!config) throw new Error("Configure Cloudflare R2 before using maintenance management.")
  if (!config.privateBucket) {
    throw new Error("Set CLOUDFLARE_R2_PRIVATE_BUCKET to a private bucket for maintenance settings.")
  }
}

async function readMaintenanceEntries(): Promise<MaintenanceEntry[]> {
  ensureMaintenanceStorage()
  const body = await downloadFromCloudflareR2(maintenanceObjectKey)
  if (!body) return []

  let document: unknown
  try {
    document = JSON.parse(body.toString("utf8"))
  } catch (error) {
    throw new Error("The maintenance settings object in R2 contains invalid JSON.", { cause: error })
  }

  if (
    typeof document !== "object" ||
    document === null ||
    !("version" in document) ||
    document.version !== 1 ||
    !("entries" in document) ||
    !Array.isArray(document.entries) ||
    !document.entries.every(isMaintenanceEntry)
  ) {
    throw new Error("The maintenance settings object in R2 has an unsupported or invalid format.")
  }

  return document.entries
}

async function writeMaintenanceEntries(entries: MaintenanceEntry[]) {
  ensureMaintenanceStorage()
  const document: MaintenanceDocument = { version: 1, entries }
  const body = Buffer.from(JSON.stringify(document), "utf8")
  await uploadToCloudflareR2(maintenanceObjectKey, body, "application/json", {
    isPublic: false,
    required: true,
  })
}

export async function listMaintenanceEntries(enabledOnly = false) {
  const config = getCloudflareR2Config()
  if (!config || !config.privateBucket) return []

  const entries = await readMaintenanceEntries()
  return entries
    .filter((entry) => !enabledOnly || entry.isEnabled)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt))
}

export async function getMaintenanceEntryByPath(requestedPath: string) {
  const activeEntries = await listMaintenanceEntries(true)
  const normalizedRequested = normalizePath(requestedPath)
  return activeEntries.find((entry) => matchesMaintenancePath(entry.path, normalizedRequested)) ?? null
}

export async function createMaintenanceEntry(input: Omit<MaintenanceEntry, "id" | "createdAt" | "updatedAt">) {
  const entries = await readMaintenanceEntries()
  const path = normalizePath(input.path)
  if (entries.some((entry) => entry.path === path)) {
    throw new Error("A maintenance entry already exists for this path.")
  }

  const now = new Date().toISOString()
  const entry: MaintenanceEntry = {
    ...input,
    id: randomUUID(),
    path,
    title: input.title.trim(),
    message: input.message.trim(),
    createdAt: now,
    updatedAt: now,
  }
  await writeMaintenanceEntries([...entries, entry])
  return entry
}

export async function updateMaintenanceEntry(id: string, input: Omit<MaintenanceEntry, "id" | "createdAt" | "updatedAt">) {
  const entries = await readMaintenanceEntries()
  const current = entries.find((entry) => entry.id === id)
  if (!current) return null

  const path = normalizePath(input.path)
  if (entries.some((entry) => entry.id !== id && entry.path === path)) {
    throw new Error("A maintenance entry already exists for this path.")
  }

  const updated: MaintenanceEntry = {
    ...current,
    ...input,
    path,
    title: input.title.trim(),
    message: input.message.trim(),
    updatedAt: new Date().toISOString(),
  }
  await writeMaintenanceEntries(entries.map((entry) => entry.id === id ? updated : entry))
  return updated
}

export async function deleteMaintenanceEntry(id: string) {
  const entries = await readMaintenanceEntries()
  const remaining = entries.filter((entry) => entry.id !== id)
  if (remaining.length === entries.length) return false
  await writeMaintenanceEntries(remaining)
  return true
}
