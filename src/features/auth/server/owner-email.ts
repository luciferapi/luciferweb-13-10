export const OWNER_EMAIL = "kspgpraveen157@gmail.com"

export function isOwnerEmail(email: string | null) {
  return typeof email === "string" && email.trim().toLowerCase() === OWNER_EMAIL
}
