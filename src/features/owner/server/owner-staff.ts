import "server-only"
import { ownerModules } from "@/features/owner/owner-modules"
import { selectMysqlRows, withMysqlTransaction } from "@/lib/mysql"
import type { RowDataPacket } from "mysql2"

export const staffRoles = ["co_owner", "admin", "customer_support"] as const
export type StaffRole = (typeof staffRoles)[number]

export type OwnerStaffMember = {
  id: string
  email: string
  name: string
  role: StaffRole
  modules: string[]
  createdAt: string
}

const primaryOwnerEmail = "kspgpraveen157@gmail.com"
const availableModules = ownerModules.filter((module) => module.slug !== "admins")

type StaffRow = RowDataPacket & {
  id: string
  email: string | null
  name: string
  is_blocked: boolean | number
  role: string
  allowed_modules: string[] | string
  created_at: Date | string
}

function parseModules(value: string[] | string, email: string): string[] {
  const modules: unknown = typeof value === "string" ? JSON.parse(value) : value
  if (!Array.isArray(modules) || !modules.every((module) => typeof module === "string")) {
    throw new Error(`Staff modules for ${email} are invalid.`)
  }
  return modules
}

function isStaffRole(value: string): value is StaffRole {
  return staffRoles.some((role) => role === value)
}

export async function listOwnerStaff(email: string) {
  const [assignments, candidates] = await Promise.all([
    selectMysqlRows<StaffRow>(
      `SELECT u.id, u.email, u.name, u.is_blocked, a.role, a.allowed_modules, a.created_at
       FROM owner_admins a
       JOIN auth_users u ON u.id = a.user_id
       ORDER BY a.created_at ASC`,
    ),
    email
      ? selectMysqlRows<RowDataPacket & { id: string; email: string | null; name: string; is_blocked: boolean | number }>(
          "SELECT id, email, name, is_blocked FROM auth_users WHERE email = ? LIMIT 1",
          [email.toLowerCase()],
        )
      : Promise.resolve([]),
  ])

  const staff: OwnerStaffMember[] = assignments.flatMap((assignment) => {
    if (!assignment.email || assignment.email.toLowerCase() === primaryOwnerEmail) return []
    if (!isStaffRole(assignment.role)) throw new Error(`Staff role for ${assignment.email} is invalid.`)
    return [{
      id: assignment.id,
      email: assignment.email,
      name: assignment.name,
      role: assignment.role,
      modules: parseModules(assignment.allowed_modules, assignment.email),
      createdAt: assignment.created_at instanceof Date
        ? assignment.created_at.toISOString()
        : new Date(assignment.created_at).toISOString(),
    }]
  })

  const candidateRow = candidates[0]
  const candidate = candidateRow && candidateRow.email?.toLowerCase() !== primaryOwnerEmail
    ? {
        id: candidateRow.id,
        email: candidateRow.email,
        name: candidateRow.name,
        isBlocked: Boolean(candidateRow.is_blocked),
        isStaff: staff.some((member) => member.id === candidateRow.id),
      }
    : null

  return {
    staff,
    candidate,
    availableModules: availableModules.map(({ slug, title }) => ({ slug, title })),
  }
}

export async function saveOwnerStaffAccess(input: {
  actorUserId: string
  email: string
  role: StaffRole
  modules: string[]
}) {
  const email = input.email.trim().toLowerCase()
  if (!email.includes("@")) return "invalid_email"
  if (!isStaffRole(input.role)) return "invalid_role"
  if (
    input.modules.length > availableModules.length ||
    new Set(input.modules).size !== input.modules.length ||
    input.modules.some((slug) => !availableModules.some((module) => module.slug === slug))
  ) return "invalid_modules"

  return withMysqlTransaction(async (connection) => {
    const [actors] = await connection.execute<RowDataPacket[]>(
      "SELECT email FROM auth_users WHERE id = ? FOR UPDATE",
      [input.actorUserId],
    )
    if ((actors[0] as { email?: string | null } | undefined)?.email?.toLowerCase() !== primaryOwnerEmail) {
      return "unauthorized"
    }

    const [targets] = await connection.execute<RowDataPacket[]>(
      "SELECT id, email, is_blocked FROM auth_users WHERE email = ? LIMIT 1 FOR UPDATE",
      [email],
    )
    const target = targets[0] as { id: string; email: string | null; is_blocked: boolean | number } | undefined
    if (!target) return "user_not_found"
    if (Boolean(target.is_blocked)) return "user_blocked"
    if (target.email?.toLowerCase() === primaryOwnerEmail) return "protected_owner"

    await connection.execute(
      `INSERT INTO owner_admins (user_id, added_by, role, allowed_modules)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE added_by = VALUES(added_by), role = VALUES(role), allowed_modules = VALUES(allowed_modules)`,
      [target.id, input.actorUserId, input.role, JSON.stringify(input.modules)],
    )
    await connection.execute(
      `INSERT INTO owner_audit_logs (actor_user_id, action, subject_user_id, details)
       VALUES (?, 'staff.access_saved', ?, ?)`,
      [input.actorUserId, target.id, JSON.stringify({ email, role: input.role, modules: input.modules })],
    )
    return "saved"
  })
}

export async function removeOwnerStaffAccess(actorUserId: string, targetUserId: string) {
  return withMysqlTransaction(async (connection) => {
    const [actors] = await connection.execute<RowDataPacket[]>(
      "SELECT email FROM auth_users WHERE id = ? FOR UPDATE",
      [actorUserId],
    )
    if ((actors[0] as { email?: string | null } | undefined)?.email?.toLowerCase() !== primaryOwnerEmail) {
      return "unauthorized"
    }
    if (actorUserId === targetUserId) return "cannot_remove_self"

    const [targets] = await connection.execute<RowDataPacket[]>(
      "SELECT id, email FROM auth_users WHERE id = ? LIMIT 1 FOR UPDATE",
      [targetUserId],
    )
    const target = targets[0] as { id: string; email: string | null } | undefined
    if (!target) return "user_not_found"
    if (target.email?.toLowerCase() === primaryOwnerEmail) return "protected_owner"

    const [assignments] = await connection.execute<RowDataPacket[]>(
      "SELECT user_id FROM owner_admins WHERE user_id = ? FOR UPDATE",
      [targetUserId],
    )
    if (assignments.length === 0) return "not_staff"

    await connection.execute("DELETE FROM owner_admins WHERE user_id = ?", [targetUserId])
    await connection.execute(
      `INSERT INTO owner_audit_logs (actor_user_id, action, subject_user_id, details)
       VALUES (?, 'staff.access_removed', ?, ?)`,
      [actorUserId, targetUserId, JSON.stringify({ email: target.email })],
    )
    return "removed"
  })
}
