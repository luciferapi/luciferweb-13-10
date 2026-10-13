import "server-only"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { ownerModules } from "@/features/owner/owner-modules"

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

function getAdminClient() {
  const client = getSupabaseAdminClient()
  if (!client) throw new Error("Supabase admin access is not configured.")
  return client
}

export async function listOwnerStaff(email: string) {
  const client = getAdminClient()
  const { data: assignments, error: assignmentsError } = await client
    .from("owner_admins")
    .select("user_id, role, allowed_modules, created_at")
    .order("created_at", { ascending: true })
  if (assignmentsError) throw assignmentsError

  const ids = [...new Set((assignments ?? []).map((assignment) => assignment.user_id))]
  const [{ data: profiles, error: profilesError }, candidateResult] = await Promise.all([
    ids.length
      ? client.from("auth_users").select("id, email, name, is_blocked").in("id", ids)
      : Promise.resolve({ data: [], error: null }),
    email
      ? client.from("auth_users").select("id, email, name, is_blocked").eq("email", email.toLowerCase()).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (profilesError) throw profilesError
  if (candidateResult.error) throw candidateResult.error

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
  const staff: OwnerStaffMember[] = (assignments ?? []).flatMap((assignment) => {
    const profile = profilesById.get(assignment.user_id)
    if (!profile?.email || profile.email.toLowerCase() === "kspgpraveen157@gmail.com") return []
    if (!staffRoles.includes(assignment.role as StaffRole)) {
      throw new Error(`Staff role for ${profile.email} is invalid.`)
    }
    return [{
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: assignment.role as StaffRole,
      modules: assignment.allowed_modules,
      createdAt: assignment.created_at,
    }]
  })

  const candidate = candidateResult.data && candidateResult.data.email?.toLowerCase() !== "kspgpraveen157@gmail.com"
    ? {
        id: candidateResult.data.id,
        email: candidateResult.data.email as string,
        name: candidateResult.data.name as string,
        isBlocked: Boolean(candidateResult.data.is_blocked),
        isStaff: staff.some((member) => member.id === candidateResult.data?.id),
      }
    : null

  return { staff, candidate, availableModules: ownerModules.filter((module) => module.slug !== "admins").map(({ slug, title }) => ({ slug, title })) }
}

export async function saveOwnerStaffAccess(input: {
  actorUserId: string
  email: string
  role: StaffRole
  modules: string[]
}) {
  const { data, error } = await getAdminClient().rpc("owner_set_staff_access", {
    p_actor_user_id: input.actorUserId,
    p_email: input.email.trim().toLowerCase(),
    p_role: input.role,
    p_allowed_modules: input.modules,
  })
  if (error) throw error
  if (typeof data !== "object" || data === null || !("status" in data) || typeof data.status !== "string") {
    throw new Error("The staff permission update returned an invalid result.")
  }
  return data.status
}

export async function removeOwnerStaffAccess(actorUserId: string, targetUserId: string) {
  const { data, error } = await getAdminClient().rpc("owner_remove_staff_access", {
    p_actor_user_id: actorUserId,
    p_target_user_id: targetUserId,
  })
  if (error) throw error
  if (typeof data !== "string") throw new Error("The staff access removal returned an invalid result.")
  return data
}
